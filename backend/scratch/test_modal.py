from playwright.sync_api import sync_playwright
import time


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Listen for console logs
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

        page.goto("http://localhost:5173/#/login")
        print("Waiting for login...")

        # We don't have credentials directly, but I can use a script to set password for manual_test_user to 'test'
        # Let's assume manual_test_user/test works if we set it.
        page.fill('input[type="text"]', "KubsonM")  # Or whatever username the user used
        page.fill('input[type="password"]', "test1234")
        page.click('button:has-text("Login")')
        page.click('button:has-text("Sign in")')  # Check standard buttons

        time.sleep(5)
        print("Current URL:", page.url)
        browser.close()


if __name__ == "__main__":
    run()
