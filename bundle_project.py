import os

def bundle_files(output_filename="bundle.txt"):
    # Define the file extensions we want to capture
    target_extensions = ('.html', '.css')
    
    # Exclude the environment folder to avoid infinite loops or scanning libraries
    exclude_dirs = {'marketplace', '.git', 'node_modules'}

    with open(output_filename, 'w', encoding='utf-8') as outfile:
        # Walk through the current directory
        for root, dirs, files in os.walk('.'):
            # Modify dirs in-place to skip excluded directories
            dirs[:] = [d for d in dirs if d not in exclude_dirs]

            for file in files:
                if file.endswith(target_extensions):
                    file_path = os.path.join(root, file)
                    
                    # Write a header for each file section
                    outfile.write(f"\n{'='*50}\n")
                    outfile.write(f"FILE: {file_path}\n")
                    outfile.write(f"{'='*50}\n\n")
                    
                    try:
                        with open(file_path, 'r', encoding='utf-8') as infile:
                            outfile.write(infile.read())
                            outfile.write("\n")
                    except Exception as e:
                        outfile.write(f"Error reading file: {e}\n")

    print(f"Successfully bundled files into {output_filename}")

if __name__ == "__main__":
    bundle_files()