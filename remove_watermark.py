import requests
import sys
import os
from PIL import Image
import io
import multiprocessing
from concurrent.futures import ProcessPoolExecutor, as_completed
import glob
import time
import re

def analyze_first_frame(input_path):
    """Analyze the first frame to determine watermark dimensions and position"""
    print(f"Analyzing first frame: {input_path}")
    with Image.open(input_path) as img:
        img_width, img_height = img.size
        print(f"Image dimensions: {img_width}x{img_height}")
        
        # Define the watermark area (bottom right)
        watermark_height = 50
        watermark_width = 767
        start_x = img_width - watermark_width
        start_y = img_height - watermark_height
        
        return {
            'img_width': img_width,
            'img_height': img_height,
            'watermark_height': watermark_height,
            'watermark_width': watermark_width,
            'start_x': start_x,
            'start_y': start_y
        }

def remove_watermark(input_path, output_path, watermark_info, max_retries=3):
    print(f"Processing image: {input_path}")
    print(f"Output path: {output_path}")
    
    # Check if input file exists
    if not os.path.exists(input_path):
        print(f"Error: Input file does not exist: {input_path}")
        return False
    
    # Ensure the output folder exists
    output_dir = os.path.dirname(output_path)
    if output_dir:
        print(f"Creating output directory: {output_dir}")
        os.makedirs(output_dir, exist_ok=True)
    
    for attempt in range(max_retries):
        try:
            # Read the image
            print("Reading input image...")
            with Image.open(input_path) as img:
                img_width, img_height = img.size
                if img_width != watermark_info['img_width'] or img_height != watermark_info['img_height']:
                    print(f"Warning: Image dimensions don't match first frame. Expected {watermark_info['img_width']}x{watermark_info['img_height']}, got {img_width}x{img_height}")
            
            # Prepare the mask with the same dimensions as the image
            print("Creating mask...")
            mask = Image.new('L', (img_width, img_height), 0)
            
            # Create a mask for the watermark region using pre-calculated values
            for y in range(watermark_info['start_y'], img_height):
                for x in range(watermark_info['start_x'], img_width):
                    mask.putpixel((x, y), 255)
            
            # Save mask to temporary file
            mask_path = f"temp_mask_{os.getpid()}.png"  # Use process ID to avoid conflicts
            mask.save(mask_path, format="PNG")
            
            # Prepare form data
            form_data = {
                'ldmSteps': '25',
                'ldmSampler': 'plms',
                'zitsWireframe': 'true',
                'hdStrategy': 'Crop',
                'hdStrategyCropMargin': '196',
                'hdStrategyCropTrigerSize': '800',
                'hdStrategyResizeLimit': '2048',
                'prompt': '',
                'negativePrompt': '',
                'croperX': '180',
                'croperY': '443',
                'croperHeight': '512',
                'croperWidth': '512',
                'useCroper': 'false',
                'sdMaskBlur': '5',
                'sdStrength': '0.75',
                'sdSteps': '50',
                'sdGuidanceScale': '7.5',
                'sdSampler': 'uni_pc',
                'sdSeed': '-1',
                'sdMatchHistograms': 'false',
                'sdScale': '1',
                'cv2Radius': '5',
                'cv2Flag': 'INPAINT_NS',
                'paintByExampleSteps': '50',
                'paintByExampleGuidanceScale': '7.5',
                'paintByExampleSeed': '-1',
                'paintByExampleMaskBlur': '5',
                'paintByExampleMatchHistograms': 'false',
                'p2pSteps': '50',
                'p2pImageGuidanceScale': '1.5',
                'p2pGuidanceScale': '7.5',
                'controlnet_conditioning_scale': '0.4',
                'controlnet_method': 'control_v11p_sd15_canny'
            }
            
            # Prepare files
            with open(input_path, 'rb') as img1, open(mask_path, 'rb') as img2:
                files = {
                    'image': ('image.png', img1, 'image/png'),
                    'mask': ('blob', img2, 'image/png')
                }
                
                # Send request to lama-cleaner
                print(f"Sending request to lama-cleaner... (Attempt {attempt + 1}/{max_retries})")
                response = requests.post('http://127.0.0.1:8080/inpaint', 
                                      data=form_data,
                                      files=files,
                                      timeout=60)  # Increased timeout
            
            # Clean up temporary mask file
            os.remove(mask_path)
            
            if response.status_code == 200:
                # Save the result
                print(f"Saving result to: {output_path}")
                with open(output_path, 'wb') as f:
                    f.write(response.content)
                print("Successfully saved the processed image!")
                return True
            else:
                print(f"Error: Server returned status code {response.status_code}")
                print("Response content:", response.text)
                
        except requests.exceptions.Timeout:
            print(f"Error: Request timed out. Attempt {attempt + 1}/{max_retries}")
            if attempt < max_retries - 1:
                print("Waiting 5 seconds before retrying...")
                time.sleep(5)
            continue
        except requests.exceptions.ConnectionError:
            print(f"Error: Could not connect to the server. Attempt {attempt + 1}/{max_retries}")
            if attempt < max_retries - 1:
                print("Waiting 5 seconds before retrying...")
                time.sleep(5)
            continue
        except Exception as e:
            print(f"An error occurred: {str(e)}")
            import traceback
            traceback.print_exc()
            return False
    
    return False

def get_frame_number(filename):
    """Extract frame number from filename"""
    match = re.search(r'frame_(\d+)\.png', filename)
    if match:
        return int(match.group(1))
    return 0

def process_frame(args):
    input_path, frame_number, watermark_info, output_dir = args
    output_filename = f"frame_{frame_number:04d}.png"
    output_path = os.path.join(output_dir, output_filename)
    
    success = remove_watermark(input_path, output_path, watermark_info)
    if success:
        return frame_number, True
    return frame_number, False

def process_directory(input_dir, output_dir):
    # Get all image files in the input directory
    image_files = sorted(glob.glob(os.path.join(input_dir, "*.png")))
    
    if not image_files:
        print("No PNG files found in the input directory")
        return
    
    # Analyze first frame to get watermark information
    watermark_info = analyze_first_frame(image_files[0])
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Get the number of CPU cores
    num_cores = multiprocessing.cpu_count()
    print(f"Using {num_cores} CPU cores for parallel processing")
    
    # Prepare arguments for parallel processing
    process_args = []
    for i, input_path in enumerate(image_files, 1):
        process_args.append((input_path, i, watermark_info, output_dir))
    
    # Process images in parallel
    with ProcessPoolExecutor(max_workers=num_cores) as executor:
        # Submit all tasks
        future_to_frame = {executor.submit(process_frame, args): args[1] for args in process_args}
        
        # Process completed tasks
        for future in as_completed(future_to_frame):
            frame_number, success = future.result()
            if success:
                print(f"Successfully processed frame {frame_number}")
            else:
                print(f"Failed to process frame {frame_number}")
            
            # Add a small delay between frames to prevent overwhelming the server
            time.sleep(1)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python remove_watermark.py <input_directory> <output_directory>")
        sys.exit(1)
    
    input_dir = sys.argv[1]
    output_dir = sys.argv[2]
    
    process_directory(input_dir, output_dir)