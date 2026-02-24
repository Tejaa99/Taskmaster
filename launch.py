# launch_silent.py
import subprocess
import webbrowser
import time
import os
import sys

def print_banner():
    print("\n" + "="*50)
    print("   🚀 TaskMaster Pro Launcher")
    print("="*50)
    print()

def start_mongodb():
    """Start MongoDB silently"""
    try:
        subprocess.run(["net", "start", "MongoDB"], 
                      capture_output=True, 
                      creationflags=subprocess.CREATE_NO_WINDOW)
    except:
        pass

def start_backend():
    """Start backend in background (no window)"""
    backend_dir = os.path.join(os.getcwd(), "backend")
    os.chdir(backend_dir)
    
    # Run backend completely hidden
    backend_process = subprocess.Popen(
        ["python", "app.py"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        stdin=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW | subprocess.DETACHED_PROCESS
    )
    
    return backend_process

def start_frontend():
    """Start frontend in background (no window)"""
    frontend_dir = os.path.join(os.getcwd(), "..", "frontend")
    os.chdir(frontend_dir)
    
    # Run frontend completely hidden
    frontend_process = subprocess.Popen(
        ["python", "-m", "http.server", "5500"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        stdin=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW | subprocess.DETACHED_PROCESS
    )
    
    return frontend_process

def main():
    print_banner()
    
    # Store original directory
    original_dir = os.getcwd()
    
    try:
        # Start MongoDB (silent)
        print("📦 Starting MongoDB...")
        start_mongodb()
        
        # Start backend (silent)
        print("📡 Starting backend server...")
        backend_process = start_backend()
        print("⏳ Waiting for backend...")
        time.sleep(3)
        
        # Start frontend (silent)
        print("🌐 Starting frontend server...")
        frontend_process = start_frontend()
        time.sleep(2)
        
        # Open browser
        print("📱 Opening TaskMaster Pro in your browser...")
        webbrowser.open("http://localhost:5500")
        
        print("\n" + "="*50)
        print("✅ TaskMaster Pro is now running!")
        print("📍 Website: http://localhost:5500")
        print("📡 Backend: http://localhost:5000")
        print("="*50)
        print("\n✨ All servers running in background (no windows)")
        print("📌 Press Ctrl+C to stop\n")
        
        # Keep running until Ctrl+C
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n\n🛑 Stopping servers...")
        try:
            backend_process.terminate()
            frontend_process.terminate()
        except:
            pass
        print("✅ All servers stopped")
        
    finally:
        os.chdir(original_dir)

if __name__ == "__main__":
    # Hide the console window itself
    if sys.platform == "win32":
        import ctypes
        ctypes.windll.user32.ShowWindow(ctypes.windll.kernel32.GetConsoleWindow(), 0)
    
    main()