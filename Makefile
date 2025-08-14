# ---- Expo/EAS Makefile (auto-clean .ipa after submit) ----
# Requirements: jq (brew install jq)

APP_JSON := app.json

.PHONY: ship ios-release ios-submit bump clean

# Build + submit with auto-bumped build number and cleanup
ship: bump
	@echo "▶ Building (local)…"
	eas build --platform ios --local --profile production --non-interactive
	@echo "▶ Locating .ipa…"
	@ipa=$$(ls -t ./build/*.ipa 2>/dev/null | head -n1); \
	if [ -z "$$ipa" ]; then ipa=$$(ls -t *.ipa 2>/dev/null | head -n1); fi; \
	if [ -z "$$ipa" ]; then echo "✖ No .ipa found after build"; exit 1; fi; \
	echo "▶ Submitting $$ipa…"; \
	if eas submit --platform ios --path "$$ipa"; then \
	  echo "✔ Submitted. Deleting $$ipa"; rm -f "$$ipa"; \
	else \
	  echo "✖ Submit failed — keeping $$ipa"; exit 1; \
	fi

# Build only (no bump, no cleanup)
ios-release:
	eas build --platform ios --local --profile production --non-interactive

# Submit latest .ipa (does NOT delete)
ios-submit:
	eas submit --platform ios --latest

# ---- helpers ----

# Bump ios.buildNumber in app.json (string increment)
bump:
	@command -v jq >/dev/null 2>&1 || { echo "jq is required (brew install jq)"; exit 1; }
	@current=$$(jq -r '.expo.ios.buildNumber // "0"' $(APP_JSON)); \
	case "$$current" in ''|*[!0-9]*) echo "Current ios.buildNumber is not numeric: '$$current'"; exit 1;; esac; \
	new=$$((current + 1)); \
	jq --arg new "$$new" '.expo.ios.buildNumber = $$new' $(APP_JSON) > $(APP_JSON).tmp && mv $(APP_JSON).tmp $(APP_JSON); \
	echo "✔ Bumped ios.buildNumber: $$current → $$new"

# Manual cleanup if needed
clean:
	rm -f ./build/*.ipa 2>/dev/null || true
	rm -f ./*.ipa 2>/dev/null || true
	rm -f ./*.dSYM.zip 2>/dev/null || true