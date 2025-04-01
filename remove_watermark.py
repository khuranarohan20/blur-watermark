import sys
import os
from PIL import Image
import cv2
import numpy as np
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
            'img_width': int(img_width),
            'img_height': int(img_height),
            'watermark_height': int(watermark_height),
            'watermark_width': int(watermark_width),
            'start_x': int(start_x),
            'start_y': int(start_y)
        }

def remove_watermark(input_path, output_path, watermark_info):
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
    
    try:
        # Read the image using OpenCV
        print("Reading input image...")
        img = cv2.imread(input_path)
        if img is None:
            print(f"Error: Could not read image: {input_path}")
            return False
            
        # Convert image to RGB (OpenCV uses BGR)
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Create mask
        print("Creating mask...")
        mask = np.zeros((img.shape[0], img.shape[1]), dtype=np.uint8)
        
        # Fill the watermark area in the mask
        mask[watermark_info['start_y']:watermark_info['img_height'], 
             watermark_info['start_x']:watermark_info['img_width']] = 255
        
        # Apply inpainting
        print("Applying inpainting...")
        # Using INPAINT_TELEA algorithm with a larger radius for better results
        result = cv2.inpaint(img, mask, inpaintRadius=10, flags=cv2.INPAINT_TELEA)
        
        # Convert back to BGR for saving
        result = cv2.cvtColor(result, cv2.COLOR_RGB2BGR)
        
        # Save the result
        print(f"Saving result to: {output_path}")
        cv2.imwrite(output_path, result)
        print("Successfully saved the processed image!")
        return True
        
    except Exception as e:
        print(f"An error occurred: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def get_frame_number(filename):
    """Extract frame number from filename"""
    match = re.search(r'frame_(\d+)\.png', filename)
    if match:
        return int(match.group(1))
    return 0

def process_frame(args):
    input_path, output_path, watermark_info = args
    return remove_watermark(input_path, output_path, watermark_info)

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
        output_filename = f"frame_{i:04d}.png"
        output_path = os.path.join(output_dir, output_filename)
        process_args.append((input_path, output_path, watermark_info))
    
    # Process images in parallel
    with ProcessPoolExecutor(max_workers=num_cores) as executor:
        # Submit all tasks
        futures = [executor.submit(process_frame, args) for args in process_args]
        
        # Process completed tasks
        for i, future in enumerate(as_completed(futures), 1):
            try:
                success = future.result()
                if success:
                    print(f"Successfully processed frame {i}")
                else:
                    print(f"Failed to process frame {i}")
            except Exception as e:
                print(f"Error processing frame {i}: {str(e)}")
            
            # Add a small delay between frames to prevent overwhelming the system
            time.sleep(0.1)  # Small delay between frames

def process_single_file(input_path, output_path, width, height, left, top):
    """Process a single file with specified watermark dimensions"""
    watermark_info = {
        'img_width': int(width),
        'img_height': int(height),
        'watermark_height': int(height),
        'watermark_width': int(width),
        'start_x': int(left),
        'start_y': int(top)
    }
    
    return remove_watermark(input_path, output_path, watermark_info)

if __name__ == "__main__":
    if len(sys.argv) == 3:
        # Directory mode
        input_dir = sys.argv[1]
        output_dir = sys.argv[2]
        process_directory(input_dir, output_dir)
    elif len(sys.argv) == 7:
        # Single file mode
        input_path = sys.argv[1]
        output_path = sys.argv[2]
        width = sys.argv[3]
        height = sys.argv[4]
        left = sys.argv[5]
        top = sys.argv[6]
        process_single_file(input_path, output_path, width, height, left, top)
    else:
        print("Usage:")
        print("  Directory mode: python remove_watermark.py <input_directory> <output_directory>")
        print("  Single file mode: python remove_watermark.py <input_file> <output_file> <width> <height> <left> <top>")
        sys.exit(1)