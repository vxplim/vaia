// electron-builder "afterPack" step: VMP-signs VAIA with castlabs EVS (free account), which
// streaming services like Netflix require before they send protected video to the installed app.
// It must happen after packing and before macOS code signing. Without EVS set up it's skipped:
// VAIA still works, and Widevine test streams still play; see PROGRESS.md "Needs Vanessa".
const { execFileSync } = require('node:child_process')

exports.default = async function vmpSign(context) {
  if (context.electronPlatformName !== 'darwin') return
  try {
    execFileSync('python3', ['-c', 'import castlabs_evs'], { stdio: 'ignore' })
  } catch {
    console.log('  • VMP signing skipped: castlabs EVS isn\'t installed (python3 -m pip install --upgrade castlabs-evs)')
    return
  }
  try {
    execFileSync('python3', ['-m', 'castlabs_evs.vmp', 'sign-pkg', context.appOutDir], { stdio: 'inherit' })
  } catch {
    console.log('  • VMP signing failed: sign in to EVS first (python3 -m castlabs_evs.account reauth)')
  }
}
