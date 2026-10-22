#!/usr/bin/env python3
"""Build a clean consumer from the npm tarball, using public native SDKs."""
import json
import argparse
import pathlib
import subprocess
import sys
import tempfile

root = pathlib.Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('destination')
parser.add_argument('--registry', action='store_true', help='Resolve the wrapper and native core only from public registries')
args = parser.parse_args()
app = pathlib.Path(args.destination).resolve()
if app.exists():
    raise SystemExit(f'Refusing to overwrite {app}')
if args.registry:
    version = json.loads((root / 'package.json').read_text())['version']
    package = f'@nudgeon/react-native@{version}'
else:
    pack = pathlib.Path(tempfile.mkdtemp(prefix='nudgeon-rn-pack-'))
    subprocess.run(['npm', 'pack', '--pack-destination', str(pack)], cwd=root, check=True)
    archives = list(pack.glob('*.tgz'))
    assert len(archives) == 1
    package = str(archives[0])
subprocess.run(['npx', '--yes', '@react-native-community/cli@20.0.0', 'init', 'NudgeOnBridgeProbe', '--version', '0.81.5', '--directory', str(app), '--skip-install', '--skip-git-init'], check=True)
subprocess.run(['npm', 'install', package], cwd=app, check=True)
android = app / 'android/build.gradle'
android.write_text(android.read_text().replace('minSdkVersion = 24', 'minSdkVersion = 26'))
podfile = app / 'ios/Podfile'
s = podfile.read_text()
if not args.registry:
    s = s.replace("target 'NudgeOnBridgeProbe' do", "target 'NudgeOnBridgeProbe' do\n  pod 'NudgeOnSDK', :podspec => 'https://raw.githubusercontent.com/NudgeOn/nudgeon-ios-sdk/0.2.9/NudgeOnSDK.podspec'")
podfile.write_text(s)
print(json.dumps({'app': str(app), 'package': package, 'registry_only': args.registry}))
