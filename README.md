# MY WORKSPACE — MyWorkCalendar Desktop

기존 MyWorkCalendar v4.1을 Electron 기반 Windows 앱으로 구성했습니다.
원본 저장소: https://github.com/kyeongyuncho/calender

## EXE 받기

GitHub 저장소의 **Actions → Build Windows EXE → 성공한 실행 → Artifacts**에서
`MyWorkCalendar-Windows-x64`를 내려받아 압축을 풉니다. GitHub 로그인이 필요합니다.

- `MyWorkCalendar-1.0.0-x64-nsis.exe`: 설치형. 바탕화면 바로가기와 Windows 자동 시작 설정을 지원합니다.
- `MyWorkCalendar-1.0.0-x64-portable.exe`: 설치 없이 실행. 자동 시작 설정은 제공하지 않습니다.
- Windows x64용입니다. Windows ARM64/32비트용 빌드는 포함하지 않습니다.
- 개인용으로 생성하는 서명 없는 EXE이므로 Windows에서 게시자를 확인할 수 없다는 경고가 표시될 수 있습니다.

## 폴더 바로가기

1. 상단 **폴더 바로가기**를 누릅니다.
2. **폴더 선택**으로 폴더를 고르거나 `C:\업무자료` / `\\서버\공유` 경로를 입력합니다.
3. 제목과 함께 저장한 뒤 **폴더 열기**를 누르면 Windows 탐색기가 열립니다.

파일이나 실행파일은 열지 않습니다. 존재하는 폴더인지 확인하고 탐색기에 전달합니다.
공유 폴더는 네트워크 연결과 계정 접근 권한이 필요하며, 연결 확인은 8초 후 시간 초과로 처리합니다.

## 기존 데이터 옮기기

기존 브라우저 앱에서 **백업 → JSON 저장**, 새 EXE에서 **복원 → 해당 JSON 선택** 순서로 옮깁니다.
브라우저 데이터가 EXE에 자동으로 복사되지는 않습니다.

기존 저장 키와 JSON 형식(`app: MyWorkCalendar`, `version: 1`)을 유지합니다.

- `my-work-calendar-v1`
- `my-work-calendar-snippets-v1`
- `my-work-calendar-folders-v1`

데스크톱 데이터는 `%APPDATA%\MyWorkCalendar` 아래에 저장합니다.
앱 파일 위치나 portable 임시 압축 해제 위치가 바뀌어도 같은 저장 공간을 사용합니다.
설치형과 portable은 같은 Windows 계정에서 데이터를 공유합니다.
정기적으로 JSON 백업을 보관하세요.

## Windows 시작 시 실행

설치형 EXE의 상단 **Windows 시작 시 실행**을 체크하면 로그인 시 자동 실행합니다.
처음에는 자동으로 켜지지 않습니다. 체크를 해제하면 자동 실행 등록을 해제합니다.
개발 실행 및 portable에서는 이 설정을 비활성화합니다.

## 직접 실행·빌드하기

Node.js 24 LTS를 설치한 뒤 `build-windows.cmd`를 실행하면 패키지 설치,
테스트, EXE 생성까지 진행합니다. 최초 실행에는 인터넷 연결이 필요합니다.
완성 파일은 `dist` 폴더에 생성됩니다.

```sh
npm install
npm test
npm run smoke
npm start
npm run build
```

`npm test`: Windows 경로 처리, 폴더만 열기, 실패 처리, 저장 키와 백업 형식을 검증합니다.
`npm run smoke`: 별도 임시 프로필로 실제 Electron 창을 숨겨 실행해 화면 초기화,
업무/폴더 저장, JSON 백업·복원, 다시 불러오기, 클립보드, preload 격리를 확인합니다.
테스트는 실제 사용자 저장 공간을 사용하지 않으며 탐색기를 열지 않습니다.
실제 폴더가 탐색기로 열리는 동작과 Windows 로그인 자동 시작은 사용자 환경에서 확인해야 합니다.

## 프로젝트 구조

- `index.html`, `style.css`, `script.js`: 기존 v4.1 웹 앱 + 폴더 열기/복사 분기
- `desktop.js`: 폴더 선택과 자동 시작 설정 UI
- `electron/main.cjs`: 창, 저장 위치, 로컬 앱 프로토콜, Windows 연동
- `electron/preload.cjs`: 화면에 필요한 기능만 노출하는 연결 계층
- `electron/folders.cjs`: Windows 폴더 경로 검사와 열기
- `tests/`: 경로 단위 테스트 및 실제 Electron 실행 테스트
- `.github/workflows/windows-build.yml`: Windows EXE 자동 빌드

Node.js를 화면 코드에 직접 노출하지 않으며 `contextIsolation`과 renderer sandbox를 사용합니다.
앱 프로토콜은 허용된 화면 파일만 제공합니다. 폴더 연동은 앱의 최상위 화면 요청만 처리합니다.
기존처럼 브라우저에서 `index.html`을 여는 것도 가능하며, 이때는 기존 브라우저 제한이 적용됩니다.
