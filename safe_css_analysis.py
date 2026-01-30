import os

def analyze_safe_files():
    # Folders we are NOT touching
    forbidden = {'itemBuilder', 'actor'}
    target_dir = './templates'
    
    print("Analyzing only Marketplace-safe templates...")
    
    for root, dirs, files in os.walk(target_dir):
        # Skip forbidden directories
        dirs[:] = [d for d in dirs if d not in forbidden]
        
        for file in files:
            # Also skip any file with 'actor' or 'builder' in the name for safety
            if any(x in file.lower() for x in ['actor', 'builder']):
                continue
                
            if file.endswith('.html'):
                print(f"Processing safe template: {os.path.join(root, file)}")
                # Your analysis logic here...

if __name__ == "__main__":
    analyze_safe_files()