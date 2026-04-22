from __init__ import create_app

app = create_app()

if __name__ == "__main__":
    print("Server is running on port 5000")
    app.run(debug=True, port=5000)
