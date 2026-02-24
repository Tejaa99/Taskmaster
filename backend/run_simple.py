# run_simple.py
import subprocess
import webbrowser
import time
import os

print("=" * 50)
print("🚀 Starting TaskMaster Pro")
print("=" * 50)

# Store the original directory
original_dir = os.getcwd()

try:
    # Step 1: Start backend in BACKGROUND
    print("📡 Starting backend server...")
    
    # Run backend in background
    backend_process = subprocess.Popen(
        ["python", "app.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        creationflags=subprocess.CREATE_NO_WINDOW  # No new window
    )
    
    # Step 2: Wait for backend to initialize
    print("⏳ Waiting for backend to start...")
    time.sleep(3)
    
    # Step 3: Start frontend in BACKGROUND
    print("🌐 Starting frontend server...")
    os.chdir("../frontend")
    
    frontend_process = subprocess.Popen(
        ["python", "-m", "http.server", "5500"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        creationflags=subprocess.CREATE_NO_WINDOW  # No new window
    )
    
    # Step 4: Wait for frontend to start
    time.sleep(2)
    
    # Step 5: Open browser automatically
    print("📱 Opening website in your browser...")
    webbrowser.open("http://localhost:5500")
    
    print("\n" + "=" * 50)
    print("✅ TaskMaster Pro is RUNNING!")
    print("📍 Website: http://localhost:5500")
    print("📡 Backend: http://localhost:5000")
    print("=" * 50)
    print("\nPress Ctrl+C to stop the application\n")
    
    # Keep the script running
    while True:
        time.sleep(1)
        
except KeyboardInterrupt:
    print("\n\n🛑 Stopping TaskMaster Pro...")
    # Clean up processes
    try:
        backend_process.terminate()
        frontend_process.terminate()
    except:
        pass
    print("✅ Application stopped")
    
finally:
    # Go back to original directory
    os.chdir(original_dir)