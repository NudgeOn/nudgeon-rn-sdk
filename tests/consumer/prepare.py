#!/usr/bin/env python3
"""Build a clean consumer from the npm tarball, using public native SDKs."""
import json
import pathlib
import subprocess
import sys
import tempfile

root = pathlib.Path(__file__).resolve().parents[2]
app = pathlib.Path(sys.argv[1]).resolve()
if app.exists():
    raise SystemExit(f'Refusing to overwrite {app}')
pack = pathlib.Path(tempfile.mkdtemp(prefix='nudgeon-rn-pack-'))
subprocess.run(['npm', 'pack', '--pack-destination', str(pack)], cwd=root, check=True)
archives = list(pack.glob('*.tgz'))
assert len(archives) == 1
subprocess.run(['npx', '--yes', '@react-native-community/cli@20.0.0', 'init', 'NudgeOnBridgeProbe', '--version', '0.81.5', '--directory', str(app), '--skip-install', '--skip-git-init'], check=True)
subprocess.run(['npm', 'install', str(archives[0])], cwd=app, check=True)
android = app / 'android/build.gradle'
android.write_text(android.read_text().replace('minSdkVersion = 24', 'minSdkVersion = 26'))
podfile = app / 'ios/Podfile'
s = podfile.read_text().replace("target 'NudgeOnBridgeProbe' do", "target 'NudgeOnBridgeProbe' do\n  pod 'NudgeOnSDK', :podspec => 'https://raw.githubusercontent.com/NudgeOn/nudgeon-ios-sdk/87da4258f7b8cbf27041d6b096815158cc0febee/NudgeOnSDK.podspec'")
podfile.write_text(s)
print(json.dumps({'app': str(app), 'package': str(archives[0])}))
