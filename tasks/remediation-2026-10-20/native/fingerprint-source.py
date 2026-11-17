from pathlib import Path
import hashlib,json,subprocess,datetime
root=Path(__file__).resolve().parents[3]
paths=set(root.joinpath('src').rglob('*.ts'))|set(root.joinpath('src').rglob('*.tsx'))
for name in ['package.json','package-lock.json','app.json','app.config.js','babel.config.js','metro.config.js','tsconfig.json','index.ts','ios/Podfile','ios/Podfile.lock','ios/Podfile.properties.json','ios/Hungry/PrivacyInfo.xcprivacy','ios/Hungry/AppDelegate.swift','ios/Hungry/Info.plist','ios/Hungry/Supporting/Expo.plist','android/build.gradle','android/app/build.gradle','android/gradle.properties','android/app/src/main/AndroidManifest.xml']:
 p=root/name
 if p.is_file():paths.add(p)
rows={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(paths) if p.is_file()}
full_ts_fingerprint=hashlib.sha256(json.dumps(rows,sort_keys=True,separators=(',',':')).encode()).hexdigest()
rows={name:digest for name,digest in rows.items() if '.test.' not in name and not name.startswith('src/test/') and '/__tests__/' not in name}
fingerprint=hashlib.sha256(json.dumps(rows,sort_keys=True,separators=(',',':')).encode()).hexdigest()
result={'capturedAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'sourceFingerprint':fingerprint,'fullTypescriptSnapshotFingerprint':full_ts_fingerprint,'files':rows,'qaEnvironment':{'EXPO_PUBLIC_APP_ENV':'development','EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE':'mock','javascriptDevBundle':False,'productionDeployment':False}}
output=Path(__file__).parent/'source-fingerprint.json';output.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'sourceFingerprint':fingerprint,'files':len(rows),'output':str(output)}))
