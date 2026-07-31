from PIL import Image, ImageEnhance, ImageFilter
import os

def compress_highlights(pixel_value):
    """
    If a pixel is normal (under 200), leave it alone.
    If a pixel is glaring bright (over 200, like the window glare), 
    compress its intensity so it doesn't blow out the image.
    """
    if pixel_value < 200:
        return pixel_value
    else:
        return int(200 + (pixel_value - 200) * 0.4)

def process_photo(input_path, output_path, is_bedroom=False):
    try:
        img = Image.open(input_path)

        # 1. Tame the Window Glare (Bedrooms Only)
        if is_bedroom:
            # Apply the compression curve to every pixel across RGB channels
            img = img.point(compress_highlights)
            
            # Use a lighter touch on contrast for indoors to avoid crushing shadows
            img = ImageEnhance.Contrast(img).enhance(1.05) 
            img = ImageEnhance.Color(img).enhance(1.1)
        else:
            # Standard punchy enhancements for exterior/dining
            img = ImageEnhance.Contrast(img).enhance(1.15)
            img = ImageEnhance.Color(img).enhance(1.2)
            img = ImageEnhance.Brightness(img).enhance(1.05)

        # 2. Universal Sharpening
        img = img.filter(ImageFilter.SHARPEN)

        img.save(output_path, quality=95)
        print(f"Successfully enhanced: {output_path}")

    except Exception as e:
        print(f"Error processing {input_path}: {e}")

# Separate your batches
bedroom_images = ["basgall.jpg", "tearose.jpg", "bissing.jpg"]
standard_images = ["house.jpg", "dining.jpg"]

print("Starting custom batch enhancement...")

# Process the bright bedroom shots
for file in bedroom_images:
    if os.path.exists(file):
        filename, ext = os.path.splitext(file)
        process_photo(file, f"{filename}_enhanced{ext}", is_bedroom=True)
    else:
        print(f"Skipped: Could not find {file}.")

# Process the standard shots
for file in standard_images:
    if os.path.exists(file):
        filename, ext = os.path.splitext(file)
        process_photo(file, f"{filename}_enhanced{ext}", is_bedroom=False)
    else:
        print(f"Skipped: Could not find {file}.")

print("Enhancement complete!")
