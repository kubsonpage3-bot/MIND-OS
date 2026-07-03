import asyncio
from playwright.async_api import async_playwright


async def run_scenario(
    name, local_storage_setup, expected_requests, check_migrated_flag=True
):
    print(f"\n{'='*50}\nSCENARIO: {name}\n{'='*50}")
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(base_url="http://localhost:5173")
        page = await context.new_page()

        # Keep track of intercepted requests
        requests_sent = []

        async def handle_request(route, request):
            if "/api/profile/" in request.url and request.method == "PATCH":
                print(f"-> NETWORK INTERCEPT: {request.method} {request.url}")
                print(f"   PAYLOAD: {request.post_data}")
                requests_sent.append(request)
            await route.continue_()

        await page.route("**/*", handle_request)

        # Login process (we need to be authenticated)
        print("Logging in as testuser...")
        await page.goto("/login")

        # Wait for page load
        try:
            await page.wait_for_selector("#username", timeout=5000)
        except Exception:
            print(
                "Failed to find login fields, assuming already logged in or server down."
            )

        await page.fill("#username", "testuser")
        await page.fill("#password", "testpassword")
        await page.click('button[type="submit"]')

        # Wait for redirect
        await page.wait_for_url("http://localhost:5173/Dashboard", timeout=10000)
        print("Logged in successfully.")

        # Close to clear session and setup the specific scenario
        await context.close()
        await browser.close()

        # NEW BROWSER FOR SCENARIO
        browser = await p.chromium.launch()
        context = await browser.new_context(
            base_url="http://localhost:5173",
            storage_state="auth.json" if False else None,
        )
        # We need to reuse the auth token. Let's just login once and save state.

        pass


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(base_url="http://localhost:5173")
        page = await context.new_page()

        print("Authenticating...")
        await page.goto("/login")
        await page.fill("#username", "testuser")
        await page.fill("#password", "testpassword")
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(5000)
        await page.screenshot(path="login_result.png")
        await context.storage_state(path="state.json")
        await context.close()

        # SCENARIO 1
        print("\n" + "=" * 50)
        print("SCENARIO 1: Existing user with analyticsEnabled: false")
        print("=" * 50)
        context = await browser.new_context(
            base_url="http://localhost:5173", storage_state="state.json"
        )
        page = await context.new_page()

        # Setup LocalStorage before navigation
        await page.goto("/")  # Go to a blank page on the origin to set LS
        await page.evaluate(
            """
            localStorage.setItem('mindos_privacy', '{"analyticsEnabled":false}');
            localStorage.removeItem('mindos_analytics_migrated');
        """
        )

        requests = []
        page.on(
            "request",
            lambda req: (
                requests.append(req)
                if "api/profile" in req.url and req.method == "PATCH"
                else None
            ),
        )
        page.on("request", lambda req: print(f"REQ: {req.method} {req.url}"))

        # Navigate to trigger React
        await page.goto("/Dashboard")
        await page.wait_for_timeout(3000)  # Give React Query time to mutate

        print(f"Requests captured: {len(requests)}")
        for r in requests:
            print(f"-> PATCH {r.url}")
            print(f"   Payload: {r.post_data}")

        migrated = await page.evaluate(
            "localStorage.getItem('mindos_analytics_migrated')"
        )
        print(f"Flag mindos_analytics_migrated: {migrated}")
        await context.close()

        # SCENARIO 2
        print("\n" + "=" * 50)
        print("SCENARIO 2: Reloading after migration (should not send again)")
        print("=" * 50)
        context = await browser.new_context(
            base_url="http://localhost:5173", storage_state="state.json"
        )
        page = await context.new_page()

        await page.goto("/")
        await page.evaluate(
            """
            localStorage.setItem('mindos_privacy', '{"analyticsEnabled":false}');
            localStorage.setItem('mindos_analytics_migrated', 'true');
        """
        )

        requests = []
        page.on(
            "request",
            lambda req: (
                requests.append(req)
                if "api/profile" in req.url and req.method == "PATCH"
                else None
            ),
        )

        await page.goto("/Dashboard")
        await page.wait_for_timeout(3000)

        print(f"Requests captured: {len(requests)}")
        if len(requests) == 0:
            print("SUCCESS: Zero migration requests fired.")
        await context.close()

        # SCENARIO 3
        print("\n" + "=" * 50)
        print("SCENARIO 3: Fresh account (no local storage)")
        print("=" * 50)
        context = await browser.new_context(
            base_url="http://localhost:5173", storage_state="state.json"
        )
        page = await context.new_page()

        await page.goto("/")
        await page.evaluate(
            """
            localStorage.removeItem('mindos_privacy');
            localStorage.removeItem('mindos_analytics_migrated');
        """
        )

        requests = []
        page.on(
            "request",
            lambda req: (
                requests.append(req)
                if "api/profile" in req.url and req.method == "PATCH"
                else None
            ),
        )

        await page.goto("/Dashboard")
        await page.wait_for_timeout(3000)

        print(f"Requests captured: {len(requests)}")
        if len(requests) == 0:
            print("SUCCESS: Zero migration requests fired.")

        migrated = await page.evaluate(
            "localStorage.getItem('mindos_analytics_migrated')"
        )
        print(f"Flag mindos_analytics_migrated: {migrated}")

        await context.close()


if __name__ == "__main__":
    asyncio.run(main())
