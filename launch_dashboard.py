"""
Grind & Crumb Dashboard Launcher
================================
Starts a lightweight local HTTP server and opens the dashboard in your default browser.
"""

import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def launch():
    print("=" * 60)
    print("GRIND & CRUMB: RECONCILIATION & EXECUTIVE DASHBOARD")
    print("=" * 60)
    print(f"Serving directory: {DIRECTORY}")
    print(f"Dashboard URL: http://localhost:{PORT}/index.html")
    print("Press Ctrl+C to stop the server.")
    print("=" * 60)

    # Open browser automatically
    webbrowser.open(f"http://localhost:{PORT}/index.html")

    # Start server
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
            sys.exit(0)

if __name__ == '__main__':
    launch()
