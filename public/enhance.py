import cv2
from cv2 import dnn_superres
import glob

def upscale_all_images(model_path):
    print("Loading AI model...")
    # Initialize the super-resolution object
    sr = dnn_superres.DnnSuperResImpl_create()
    
    # Load the model
    try:
        sr.readModel(model_path)
        sr.setModel("edsr", 4)
    except Exception as e:
        print(f"Error loading model: {e}")
        return

    # Find all .jpg files in the current folder
    image_files = glob.glob("*.jpg")
    
    if not image_files:
        print("No .jpg files found in this directory.")
        return

    print(f"Found {len(image_files)} image(s) to process.")

    # Loop through each image and upscale it
    for file_path in image_files:
        # Skip images we have already upscaled to prevent endless loops
        if "_4x" in file_path:
            continue
            
        print(f"Upscaling {file_path}...")
        image = cv2.imread(file_path)
        
        if image is None:
            print(f"  -> Error: Could not read {file_path}. Skipping.")
            continue

        # Upsample the image
        result = sr.upsample(image)

        # Create a new filename (e.g., basgall.jpg -> basgall_4x.jpg)
        output_path = file_path.replace(".jpg", "_4x.jpg")
        
        # Save the result
        cv2.imwrite(output_path, result)
        print(f"  -> Saved as {output_path}")

    print("All finished!")

# Run the function
upscale_all_images('EDSR_x4.pb')
