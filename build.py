import os
import shutil
import subprocess
import sys

def compile_css(watch=False, minify=True):
    """Handles Tailwind CSS compilation."""
    mode = "Watching" if watch else "Compiling"
    print(f"{mode} Tailwind CSS...")
    
    command = [
        "npx", "tailwindcss", 
        "-i", "./src/css/tailwind-input.css", 
        "-o", "./styles/marketplace.css"
    ]
    
    if watch:
        command.append("--watch")
    if minify and not watch:
        command.append("--minify")

    try:
        # Added shell=True to fix [WinError 2] on Windows
        subprocess.run(command, check=True, shell=True)
        if not watch:
            print("✅ CSS Bundled successfully in ./styles/marketplace.css")
    except Exception as e:
        print(f"❌ Error during CSS operation: {e}")
        sys.exit(1)

def run_dist():
    """Handles full distribution packaging."""
    dist_folder = './dist'
    folders_to_copy = [
        'languages', 'models', 'packs', 'scripts', 
        'sheets', 'styles', 'templates', 'tests', 'utils'
    ]
    files_to_copy = ['LICENSE', 'module.json', 'README.md']
    
    # 1. First, ensure a fresh CSS build
    compile_css(watch=False, minify=True)

    # 2. Clean/Create Dist Folder
    if os.path.exists(dist_folder):
        print(f"Cleaning existing {dist_folder}...")
        shutil.rmtree(dist_folder)
    os.makedirs(dist_folder)

    # 3. Copy Folders
    for folder in folders_to_copy:
        if os.path.exists(folder):
            print(f"Copying folder: {folder}")
            shutil.copytree(folder, os.path.join(dist_folder, folder))

    # 4. Copy Root Files
    for file in files_to_copy:
        if os.path.exists(file):
            print(f"Copying file: {file}")
            shutil.copy2(file, dist_folder)

    print(f"\n🚀 Build Complete! Distribution ready in {dist_folder}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python build_project.py [build | watch | dist]")
        sys.exit(1)

    command = sys.argv[1].lower()

    if command == "build":
        compile_css(watch=False, minify=True)
    elif command == "watch":
        compile_css(watch=True, minify=False)
    elif command == "dist":
        run_dist()
    else:
        print(f"Unknown command: {command}")
        print("Available commands: build, watch, dist")