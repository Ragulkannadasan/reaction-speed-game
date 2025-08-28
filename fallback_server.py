"""
Simple Python HTTP Server for Brain Reaction Game
This is a fallback option if Node.js is not available
"""

import http.server
import socketserver
import webbrowser
import os
import sys

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory="public", **kwargs)
    
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

def start_server():
    PORT = 8000
    
    print("=" * 50)
    print("  BRAIN REACTION GAME - PYTHON FALLBACK SERVER")
    print("=" * 50)
    print()
    print("⚠️  WARNING: This is a static file server only!")
    print("   The full multiplayer features require Node.js")
    print()
    print("📁 Serving files from: public/")
    print(f"🌐 Server URL: http://localhost:{PORT}")
    print()
    print("To get full functionality:")
    print("1. Install Node.js from https://nodejs.org/")
    print("2. Run 'npm install' in this directory")
    print("3. Run 'npm start' to start the real server")
    print()
    print("Press Ctrl+C to stop this server")
    print("-" * 50)
    
    try:
        with socketserver.TCPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
            print(f"✅ Server started at http://localhost:{PORT}")
            
            # Try to open browser
            try:
                webbrowser.open(f'http://localhost:{PORT}')
                print("🌐 Opening browser...")
            except:
                print("💡 Please open http://localhost:{PORT} in your browser")
            
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        print("💡 Make sure port 8000 is not in use")

if __name__ == "__main__":
    # Change to script directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Check if public directory exists
    if not os.path.exists("public"):
        print("❌ Error: 'public' directory not found!")
        print("   Make sure you're running this from the game directory")
        sys.exit(1)
    
    start_server()