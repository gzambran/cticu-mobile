const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Apple clang 21 (Xcode 26.4+) rejects fmt 11.0.2's FMT_STRING consteval checks,
// which breaks every Expo SDK up to and including 55. A command-line
// -DFMT_USE_CONSTEVAL=0 does NOT work: fmt/include/fmt/base.h defines
// FMT_USE_CONSTEVAL via an unguarded #if/#elif chain that unconditionally
// overwrites any externally supplied value (base.h's `#elif defined(__cpp_consteval)`
// branch sets it back to 1). Instead, this compiles the `fmt` pod target itself at
// C++17: base.h's `#elif FMT_CPLUSPLUS < 201709L` branch then makes fmt's own logic
// select FMT_USE_CONSTEVAL 0, which is the one thing the header can't override.
//
// IMPORTANT for injection order: this patch MUST run after react_native_post_install(...),
// not merely after `post_install do |installer|`. react_native_post_install resets
// CLANG_CXX_LANGUAGE_STANDARD to c++20 on every pod target, so injecting before it
// gets silently overwritten. Do not move this back to right after the post_install anchor.
//
// SDK 56 ships fmt 12.1.0 and does not need this. Delete this plugin then.
const PATCH_MARKER = 'fmt-consteval-workaround';

// Scoped to the fmt target deliberately: do NOT widen this to all targets, as that
// would downgrade the whole project to C++17.
const PATCH = `
    # fmt-consteval-workaround
    # fmt 11.0.2's FMT_STRING compile-time checks fail under Apple clang 21 (Xcode 26.4+).
    # base.h defines FMT_USE_CONSTEVAL via an UNGUARDED #if/#elif chain, so passing
    # -DFMT_USE_CONSTEVAL=0 is silently overwritten by the header (base.h:127) and does
    # nothing. Building fmt itself at C++17 instead makes base.h:116
    # (\`#elif FMT_CPLUSPLUS < 201709L\`) select FMT_USE_CONSTEVAL 0 through fmt's own logic.
    # Scoped to the fmt target deliberately: do NOT widen this to all targets, as that
    # would downgrade the whole project to C++17.
    # Expo SDK 56 ships fmt 12.1.0 and needs none of this. Delete this plugin then.
    installer.pods_project.targets.each do |pod_target|
      next unless pod_target.name == 'fmt'
      pod_target.build_configurations.each do |pod_config|
        pod_config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
      end
    end
`;

module.exports = function withFmtConstevalFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (innerConfig) => {
      const podfilePath = path.join(
        innerConfig.modRequest.platformProjectRoot,
        'Podfile'
      );
      const contents = fs.readFileSync(podfilePath, 'utf8');

      if (contents.includes(PATCH_MARKER)) {
        return innerConfig;
      }

      // Match the whole react_native_post_install(...) call through its closing
      // paren, so the patch can be injected immediately after it (see comment above
      // on why the injection order matters).
      const RN_POST_INSTALL = /react_native_post_install\([\s\S]*?\n\s*\)\n/;
      if (!RN_POST_INSTALL.test(contents)) {
        throw new Error(
          'withFmtConstevalFix: could not find the react_native_post_install(...) call in Podfile'
        );
      }

      fs.writeFileSync(
        podfilePath,
        contents.replace(RN_POST_INSTALL, (match) => match + PATCH)
      );
      return innerConfig;
    },
  ]);
};
