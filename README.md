# CORNEA LAB

한국어 각막 / CRT 렌즈 교육용 3D 기하 탐색기. 빌드 과정 없이 동작하는 정적 ES module 웹 앱입니다.

## 실행

Node.js가 설치된 상태에서 이 디렉터리에서 `npm start` 실행 후 http://127.0.0.1:4173 에 접속합니다. ES module과 WebGL을 사용하므로 HTML을 파일 탐색기에서 직접 여는 대신 HTTP로 실행합니다. 배포 파일은 `dist/`에 있습니다. Three.js 0.170.0은 로컬 vendor에 포함하고 MIT 라이선스를 동봉했습니다. 폰트는 Google Fonts에서 로드하며 오프라인에서는 시스템 폰트로 표시합니다.

## 기능

- Flat/Steep K, Steep axis 및 가정한 Q로 구성한 비구면 각막 전면
- BC(mm), RZD(µm), LZA(도), 10.5/11.0 mm 직경의 CRT 유사 후면
- 렌즈 수평/수직 이동, 두 방향 기울기, 수직 이동만 이용한 자동 안착 또는 수동 높이
- 각각의 3D 보기, 회전/확대, 정면/측면, 분리/메시/수직 깊이 강조, 간격 색상
- Flat/Steep 주경선 단면, 수직 간격 지도, 설명 가능한 기하 지표
- 기본/난시/이동/기울기/간섭 시나리오, 브라우저 내 설정 보관, JSON 내보내기

## 모델과 단위

`geometry.js`는 mm 좌표계를 사용합니다. +x는 화면 오른쪽, +y는 위쪽, +z는 전방이고 각막 꼭짓점은 z=0입니다. Steep axis는 +x에서 반시계방향이며 Flat axis는 90° 직교한다고 가정합니다. 반경은 각막계 굴절률 1.3375의 관례에 따른 `337.5/K`입니다. 표시 각막 직경 11.8 mm는 고정이며 Q는 기본 -0.25입니다.

렌즈는 반경0–3mm 구면, 3–4mm의 C2 5차 보간 Return zone, tan(LZA) 기울기의 Landing zone으로 구성합니다. RZD는 r3에서 r4까지의 sag 증가입니다. 말단0.35mm에25µm 들림을 별도로 가정했습니다. 3D 앞면과0.14mm 두께는 시각화용입니다. 정확한 제조사 가공 형상이나 CAD를 복원하지 않습니다. 입력 범위는 주문 가능 목록이 아닙니다.

`sampleFit`은 유한 Cartesian + polar 샘플 최소 수직 간격이2µm가 되도록 높이만 조절합니다. `fit.params`에 반영된 높이를 사용해 렌더링합니다. 중심 간격은 렌즈 중심 위치, 말단부 평균은 마지막0.35mm의 면적 격자 평균입니다. 반환 gap 단위는µm, `clearance`는mm입니다. 기울기는 평면 slope 근사이며 강체 회전이 아닙니다. 표시 각막 바깥에서는 동일 표면을 외삽하며 실수 범위를 벗어나면 NaN으로 제외합니다. 지도 빈 영역과3D 회색은 계산 불가입니다.

**ARK의 K 및 축만으로 각막 전체를 재구성할 수 없습니다.** 비구면도, 주변부 높이, 비대칭, 후면 및 두께를 측정하지 않습니다. 실제 분석에는 지형도/단층촬영/고도 자료가 필요합니다. 눈물 유체, 압력, 눈꺼풀, 안정성, 각막 변형, 치료 후 상피 변화, 교정 효과 및 임상적 적합도는 계산하지 않습니다. 음수 gap은 표면의 수학적 겹침입니다. 임상 검증을 거치지 않은 교육 도구입니다.

## 검증

`npm test`는 독립적 구면 기준값, 축 회전, RZD 단위, 구역 연속성, LZA 접선, 말단 가정, 두 직경, 위치/기울기, 수직 안착 및 gap 일치 여부를 확인합니다. 브라우저에서는 WebGL 렌더링, 입력 연동, 모델 전환, 시나리오, JSON 저장 및 반응형 화면을 확인합니다. 수치 테스트는 임상 검증을 뜻하지 않습니다.

## 공식 자료

- [Paragon 자료 진입점](https://paragonvision.com/resources/fitting-guides-package-inserts/)
- [FDA Professional Fitting Information](https://www.accessdata.fda.gov/cdrh_docs/pdf/P870024S043c.pdf)
- [FDA CRT 100 Package Insert](https://www.accessdata.fda.gov/cdrh_docs/pdf5/P050031C.pdf)
- [NIDEK ARK-1 사양](https://www.nidek.co.jp/wp-content/uploads/2024/02/ARK_1_AR_1_B01J005.pdf)

Paragon/CooperVision의 공식 제품이 아닙니다. 모든 표시는 정적 교육 모델의 출력입니다.
