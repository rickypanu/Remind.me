import os
from google import genai
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

# Initialize the new Google GenAI client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

print("Available Models for your API Key:")
print("-" * 40)

try:
    # Loop through and print all available models
    for model in client.models.list():
        print(f"Model Name: {model.name}")
        print(f"Display Name: {model.display_name}")
        print(f"Supported Actions: {model.supported_actions}")
        print("-" * 40)
except Exception as e:
    print(f"Error fetching models: {e}")