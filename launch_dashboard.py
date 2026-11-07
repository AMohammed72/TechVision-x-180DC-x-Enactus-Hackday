"""
Grind & Crumb Dashboard Launcher & Validation API Server
========================================================
Starts a lightweight local HTTP server, exposes CSV validation endpoints powered by
validate_grind_crumb.py, and opens the dashboard in your default browser.
"""

import http.server
import socketserver
import webbrowser
import os
import sys
import json
from validate_grind_crumb import validate_uploaded_csv, validate_dataset

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(DIRECTORY, "grind_and_crumb_data")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        if self.path.startswith("/api/validate-dataset"):
            try:
                report = validate_dataset(DATA_DIR)
                payload = json.dumps(report).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
            except Exception as e:
                err = json.dumps({"status": "FAIL", "error": str(e)}).encode("utf-8")
                self.send_response(500)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(err)
            return
        super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/validate-csv"):
            try:
                length = int(self.headers.get("Content-Length", "0"))
                raw_body = self.rfile.read(length).decode("utf-8", errors="replace")
                req = json.loads(raw_body)
                filename = req.get("filename", "uploaded.csv")
                content = req.get("content", "")
                report = validate_uploaded_csv(filename, content, data_dir=DATA_DIR)
                payload = json.dumps(report).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
            except Exception as e:
                err = json.dumps({"status": "FAIL", "error": str(e)}).encode("utf-8")
                self.send_response(400)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(err)
            return
        self.send_response(404)
        self.end_headers()


def launch():
    print("=" * 60)
    print("GRIND & CRUMB: RECONCILIATION & EXECUTIVE DASHBOARD")
    print("=" * 60)
    print(f"Serving directory: {DIRECTORY}")
    print(f"Dashboard URL: http://localhost:{PORT}/index.html")
    print(f"Validation API: http://localhost:{PORT}/api/validate-csv")
    print("Press Ctrl+C to stop the server.")
    print("=" * 60)

    webbrowser.open(f"http://localhost:{PORT}/index.html")

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
            sys.exit(0)


if __name__ == '__main__':
    launch()
