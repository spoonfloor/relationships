#!/usr/bin/env python3
"""Serve relationships locally for development."""

import http.server
import os
import socketserver

PORT = 5001
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), "public")


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "application/javascript",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
    }


if __name__ == "__main__":
    os.chdir(PUBLIC_DIR)
    socketserver.TCPServer.allow_reuse_address = True

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"relationships → http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")
