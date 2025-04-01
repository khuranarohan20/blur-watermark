import os
import requests
import glob
import time
import re
import multiprocessing
from concurrent.futures import ProcessPoolExecutor, as_completed
from PIL import Image
import uuid

# API Parameters
form_data = {
    'ldmSteps': '25', 'ldmSampler': 'plms', 'zitsWireframe': 'true',
    'hdStrategy': 'Crop', 'hdStrategyCropMargin': '196', 'hdStrategyCropTrigerSize': '800',
    'hdStrategyResizeLimit': '2048', 'prompt': '', 'negativePrompt': '',
    'croperX': '180', 'croperY': '443', 'croperHeight': '512', 'croperWidth': '512',
    'useCroper': 'false', 'sdMaskBlur': '5', 'sdStrength': '0.75', 'sdSteps': '50',
    'sdGuidanceScale': '7.5', 'sdSampler': 'uni_pc', 'sdSeed': '-1', 'sdMatchHistograms': 'false',
    'sdScale': '1', 'cv2Radius': '5', 'cv2Flag': 'INPAINT_NS', 'paintByExampleSteps': '50',
    'paintByExampleGuidanceScale': '7.5', 'paintByExampleSeed': '-1', 'paintByExampleMaskBlur': '5',
    'paintByExampleMatchHistograms': 'false', 'p2pSteps': '50', 'p2pImageGuidanceScale': '1.5',
    'p2pGuidanceScale': '7.5', 'controlnet_conditioning_scale': '0.4',
    'controlnet_method': 'control_v11p_sd15_canny'
}

def analyze_first_frame(input_path):
    """Analyze the first frame to determine watermark dimensions and position."""
    print(f"Analyzing first frame: {input_path}")
    with Image.open(input_path) as img:
        img_width, img_height = img.size
        
        # Define watermark position (bottom-right)
        watermark_height = 50  
        watermark_width = img_width // 5  
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

def create_mask(image_info, mask_path):
    """Create a mask for the watermark region."""
    print(f"Creating mask: {mask_path}")
    mask = Image.new('L', (image_info['img_width'], image_info['img_height']), 0)
    
    for y in range(image_info['start_y'], image_info['img_height']):
        for x in range(image_info['start_x'], image_info['img_width']):
            mask.putpixel((x, y), 255)
    
    mask.save(mask_path, format="PNG")

def remove_watermark(input_path, output_path, watermark_info):
    """Send a request to Lama Cleaner API to remove the watermark."""
    print(f"Processing image: {input_path}")
    mask_path = f"temp_mask_{uuid.uuid4().hex}.png"  # Unique filename per process

    try:
        create_mask(watermark_info, mask_path)

        with open(input_path, 'rb') as img, open(mask_path, 'rb') as mask:
            files = {'image': ('image.png', img, 'image/png'), 'mask': ('blob', mask, 'image/png')}
            
            response = requests.post('http://127.0.0.1:8080/inpaint', 
                         data=form_data,
                         files=files,
                         timeout=30)

            if response.status_code == 200:
                with open(output_path, 'wb') as f:
                    f.write(response.content)
                print(f"Successfully processed {input_path} -> {output_path}")
                return True
            else:
                print(f"Error: Server returned status code {response.status_code}")
                return False

    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")
        return False

    finally:
        if os.path.exists(mask_path):
            os.remove(mask_path)  # Ensure file cleanup

def process_frame(args):
    """Wrapper function to process frames in parallel."""
    input_path, output_path, watermark_info = args
    return remove_watermark(input_path, output_path, watermark_info)

def process_directory(input_dir, output_dir):
    """Process all frames in a directory using parallel processing."""
    image_files = sorted(glob.glob(os.path.join(input_dir, "*.png")), key=get_frame_number)
    
    if not image_files:
        print("No PNG files found in the input directory")
        return
    
    watermark_info = analyze_first_frame(image_files[0])
    os.makedirs(output_dir, exist_ok=True)
    
    num_cores = min(multiprocessing.cpu_count(), 4)  # Limit to 4 to avoid overloading API
    print(f"Using {num_cores} CPU cores for parallel processing")
    
    process_args = [(img, os.path.join(output_dir, os.path.basename(img)), watermark_info) for img in image_files]
    
    with ProcessPoolExecutor(max_workers=num_cores) as executor:
        futures = [executor.submit(process_frame, args) for args in process_args]
        
        for i, future in enumerate(as_completed(futures), 1):
            try:
                future.result()
            except Exception as e:
                print(f"Error processing frame {i}: {e}")
            time.sleep(0.1)  # Small delay to prevent overwhelming the API

def get_frame_number(filename):
    """Extract frame number from filename."""
    match = re.search(r'frame_(\d+)\.png', filename)
    return int(match.group(1)) if match else 0

if __name__ == "__main__":
    import sys
    if len(sys.argv) == 3:
        process_directory(sys.argv[1], sys.argv[2])
    else:
        print("Usage: python remove_watermark.py <input_directory> <output_directory>")
