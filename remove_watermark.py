import cv2
import numpy as np
import sys

def remove_watermark(input_path, output_path, width, height, left, top):
    img = cv2.imread(input_path)
    
    height, width, _ = img.shape 
    
    width = int(width)
    height = int(height)
    left = int(left)
    top = int(top)

    mask = np.zeros(img.shape[:2], dtype=np.uint8)

    # Define the watermark area (bottom right)
    watermark_height = 50
    watermark_width = 767
    start_x = width - watermark_width  # X-coordinate starts from right
    start_y = height - watermark_height  # Y-coordinate starts from bottom

    # Fill the mask for the watermark region
    mask[start_y:height, start_x:width] = 255

    # Apply inpainting
    inpainted = cv2.inpaint(img, mask, inpaintRadius=3, flags=cv2.INPAINT_TELEA)
    cv2.imwrite(output_path, inpainted)


remove_watermark(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6])