import os
import sys
import subprocess
import time

def check_python_packages():
    """Checks and installs missing Python dependencies from backend/requirements.txt."""
    print("=" * 60)
    print("Checking Python Backend Dependencies...")
    print("=" * 60)
    
    required_packages = [
        ("fastapi", "fastapi"),
        ("uvicorn", "uvicorn"),
        ("sqlalchemy", "sqlalchemy"),
        ("pydantic", "pydantic"),
        ("pandas", "pandas"),
        ("numpy", "numpy"),
        ("sklearn", "scikit-learn"),
        ("xgboost", "xgboost"),
        ("joblib", "joblib"),
        ("multipart", "python-multipart")
    ]
    
    missing_any = False
    for module_name, pip_name in required_packages:
        try:
            __import__(module_name)
        except ImportError:
            print(f"[-] Missing library: {pip_name}")
            missing_any = True
            
    if missing_any:
        print("\nMissing packages detected. Auto-installing dependencies via pip...")
        try:
            req_path = os.path.join("backend", "requirements.txt")
            subprocess.run([sys.executable, "-m", "pip", "install", "-r", req_path], check=True)
            print("[+] All backend Python dependencies successfully installed.")
        except subprocess.CalledProcessError as e:
            print(f"[!] Critical Error: Failed to install Python dependencies: {e}")
            sys.exit(1)
    else:
        print("[+] All Python dependencies are already satisfied.")
    print()

def install_frontend_packages():
    """Checks and installs missing NPM dependencies for the React frontend."""
    print("=" * 60)
    print("Checking React Frontend Dependencies...")
    print("=" * 60)
    
    frontend_dir = os.path.join(os.getcwd(), "frontend")
    node_modules = os.path.join(frontend_dir, "node_modules")
    
    if not os.path.exists(node_modules):
        print("[-] node_modules not found. Auto-installing npm dependencies (this may take a minute)...")
        try:
            # We run 'cmd /c npm install' to bypass PowerShell script execution restrictions
            subprocess.run("cmd /c npm install", shell=True, cwd=frontend_dir, check=True)
            print("[+] React frontend npm dependencies successfully installed.")
        except subprocess.CalledProcessError as e:
            print(f"[!] Critical Error: Failed to install React npm packages: {e}")
            sys.exit(1)
    else:
        print("[+] React frontend npm dependencies are already satisfied.")
    print()

def main():
    # 1. Execute checks and installs
    check_python_packages()
    install_frontend_packages()
    
    backend_dir = os.path.join(os.getcwd(), "backend")
    frontend_dir = os.path.join(os.getcwd(), "frontend")
    
    print("=" * 60)
    print("Starting Fraud Detection Application Services...")
    print("=" * 60)
    print("FastAPI Backend: http://127.0.0.1:8000")
    print("React Frontend:  http://localhost:5173")
    print("Press Ctrl+C to terminate both servers.")
    print("=" * 60)
    print()

    # 2. Spawn FastAPI server
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=backend_dir
    )
    
    # 3. Spawn React Frontend Dev server (Vite)
    frontend_proc = subprocess.Popen(
        "cmd /c npm run dev",
        shell=True,
        cwd=frontend_dir
    )
    
    # 4. Monitor process states
    try:
        while True:
            if backend_proc.poll() is not None:
                print("[!] Error: FastAPI backend server terminated unexpectedly.")
                break
            if frontend_proc.poll() is not None:
                print("[!] Error: React frontend dev server terminated unexpectedly.")
                break
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[~] Shutdown signal received (Ctrl+C). Terminating servers...")
    finally:
        # 5. Graceful Cleanup
        backend_proc.terminate()
        frontend_proc.terminate()
        try:
            backend_proc.wait(timeout=3)
            frontend_proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            # Force kill if they hang
            backend_proc.kill()
            frontend_proc.kill()
        print("[+] Services stopped successfully. Goodbye!")

if __name__ == "__main__":
    main()
