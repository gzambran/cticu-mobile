const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Apple clang 21 (Xcode 26.4+) rejects fmt 11.0.2's FMT_STRING consteval checks,
// which breaks every Expo SDK up to and including 55. Disabling FMT_USE_CONSTEVAL
// moves fmt's format-string validation from compile time to runtime; the affected
// format strings live inside React Native's own vendored code.
// SDK 56 ships fmt 12.1.0 and does not need this. Delete this plugin then.
const PATCH_MARKER = 'FMT_USE_CONSTEVAL=0';

// Intentionally broad: this loops over every pod target, not just `fmt`.
// fmt's headers are pulled in by RCT-Folly and other targets, so a filter
// narrowed to the `fmt` target alone would still leave those targets failing.
// Do not "fix" this into a name == 'fmt' filter.
const PATCH = `
    # Temporary: fmt 11.0.2 vs Apple clang 21. Remove on Expo SDK 56.
    installer.pods_project.targets.each do |pod_target|
      pod_target.build_configurations.each do |pod_config|
        defs = pod_config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] || ['$(inherited)']
        defs = [defs] unless defs.is_a?(Array)
        pod_config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = defs + ['FMT_USE_CONSTEVAL=0']
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

      const anchor = 'post_install do |installer|';
      if (!contents.includes(anchor)) {
        throw new Error(
          'withFmtConstevalFix: could not find post_install hook in Podfile'
        );
      }

      fs.writeFileSync(
        podfilePath,
        contents.replace(anchor, anchor + '\n' + PATCH)
      );
      return innerConfig;
    },
  ]);
};
