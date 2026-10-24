# CORNEA LAB

한국어 각막 / CRT 렌즈 교육용 3D 기하 탐색기. 빌드 과정 없이 동작하는 정적 ES module 웹 앱입니다.

## 온라인

https://cucube1985.github.io/cornea-crt-lab/

## 소스 관리와 배포

이 프로젝트는 [GitHub 저장소](https://github.com/cucube1985/cornea-crt-lab)의 `main` 브랜치를 기준으로 관리하고 GitHub Pages로 배포합니다.

작업 순서는 **최신 소스 확인 → 수정 및 로컬 확인 → 테스트 → 커밋·푸시 → GitHub Actions 배포 확인**입니다. `main`에 푸시하면 [배포 워크플로](https://github.com/cucube1985/cornea-crt-lab/actions/workflows/pages.yml)가 `npm test`를 실행하고 `dist/`를 게시합니다. 브라우저 파일 선택기로 소스를 매번 올릴 필요는 없습니다.

```powershell
# 이 README가 있는 저장소 디렉터리에서 실행
git pull --ff-only origin main
npm start
# 앱 수정 후
npm test
# 변경 내용을 검토한 뒤 필요한 파일만 커밋하고 푸시
git push origin main
```

상위 작업 폴더와 이 앱의 Git 저장소가 다를 수 있으므로 이 README가 있는 디렉터리에서 작업합니다. 이전 배포의 `.openai/hosting.json`은 GitHub Pages 배포에 사용되지 않습니다. 이후 작업은 GitHub와 GitHub Pages를 사용합니다.

## 실행

Node.js가 설치된 상태에서 이 디렉터리에서 `npm start` 실행 후 http://127.0.0.1:4173 에 접속합니다. ES module과 WebGL을 사용하므로 HTML을 파일 탐색기에서 직접 여는 대신 HTTP로 실행합니다. 배포 파일은 `dist/`에 있습니다. Three.js 0.170.0은 로컬 vendor에 포함하고 MIT 라이선스를 동봉했습니다. 폰트는 Google Fonts에서 로드하며 오프라인에서는 시스템 폰트로 표시합니다.

## 기능

- 상단에서 **Basic / OK / Basic-OK / Advanced** 구현 모델 선택
- Flat/Steep K, Steep axis 및 가정한 Q로 구성한 비구면 각막 전면
- BC(mm), RZD(µm), LZA(도), 10.5/11.0 mm 직경의 CRT 유사 후면
- 렌즈 수평/수직 이동, 두 방향 기울기, 수직 이동만 이용한 자동 안착 또는 수동 높이
- 각각의 3D 보기, 회전/확대, 정면/측면, 분리/메시/수직 깊이 강조, 간격 색상
- Flat/Steep 주경선 단면, 수직 간격 지도, 설명 가능한 기하 지표
- 기본/난시/이동/기울기/간섭 시나리오, 브라우저 내 설정 보관, JSON 내보내기

## 구현 모델 선택

| 모델 | 표시·계산 범위 |
| --- | --- |
| Basic | Flat K·Steep K·축으로 만든 단순 각막만 표시. 초기 버전의 Q −0.25, 직경 11.8 mm를 고정 가정 |
| OK | BC·RZD·LZA·10.5/11.0 mm 직경으로 CRT 렌즈 형상만 표시. 각막·이동·기울기·자동 안착 제외 |
| Basic-OK | Basic 각막 + CRT 렌즈. 정적 위치·수직 간격·간격 지도 비교 |
| Advanced | 추가 전안부 수기 입력, 동공·치료 영역 표시, 환자별 A/B 비교. 각막/렌즈/피팅 보기 제공 |

기존 화면인 Advanced가 처음 선택됩니다. 모델 전환은 Advanced 입력값을 지우지 않습니다. Basic 계열에서는 추가 측정값을 계산에서 제외하고 고정 가정을 적용합니다. ARK K/축과 CRT 설계값은 해당 입력을 사용하는 모델끼리 공유합니다. 환자 설정 저장·불러오기와 A/B 비교는 Advanced에서 사용합니다. 초기화는 모든 모델의 공유 입력값과 환자 조건을 기본값으로 되돌리며 현재 모델 선택은 유지합니다.

## 환자별 수기 입력과 비교 (Advanced)

`①~⑤ 조건 입력`에서 **HVID/수직 직경, Flat·Steep별 Q 또는 e, Ø8·Ø10 mm 주변부 평균 Sag, Ø8 mm 비측−이측/상측−하측 높이 차이, 동공 직경·중심**을 입력합니다. 장비 파일을 내보낼 필요 없이 수치로 입력하며, 값의 출처를 가정/수기/측정으로 구분합니다. AXL은 기록용입니다.

현재 조건을 A와 B에 각각 담아 같은 환자의 렌즈/조건, 서로 다른 환자, 착용 전후를 비교할 수 있습니다. 동일 축척 정면 그림, 단면 겹침, 수치 차이 표와 설명을 제공합니다. 동공과 별도로 입력한 치료 영역의 면적 겹침을 표시하며, 렌즈 BC 직경을 치료 영역으로 대신 사용하지 않습니다.

자료는 기본적으로 메모리에만 있으며, 사용자가 직접 선택하면 이 기기에 보관하거나 JSON으로 저장하고 불러올 수 있습니다. 측정값을 서버나 GitHub에 전송하는 기능은 없습니다. 비교표 인쇄도 지원합니다. 정의·좌표·BFS 입력 조건과 가상 예시는 [환자 비교 안내](docs/patient-comparison.md)를 확인하세요.

## 추천 렌즈 불러오기

CRT 렌즈 설계 패널의 **추천 렌즈 불러오기**는 외부 CRT 계산기(예: [VISUWORKS CRT Parameter Calculator](https://visuworks-dev.github.io/ParagonCRT-Calculator/))에서 받은 결과를 모델에 옮기는 기능입니다. 계산기 링크를 새 탭으로 열어 결과를 복사해 붙여넣으면 `dist/recommend.js`가 BC, RZD1, RZD2, LZA, OAD, K1/K2, Ecc와 DA 권장 여부를 인식해 입력칸을 채웁니다. 직접 입력해도 됩니다. 적용 시 BC·RZD1·LZA·OAD·K값과 (Ecc 입력 시) Q = −Ecc²를 모델에 채우며, 단일 축 모델이므로 RZD2는 적용하지 않습니다. CORNEA LAB은 추천 계산식을 포함하지 않으며 외부 계산기 제공자와 관련이 없습니다. 출력은 참고용 시작값이며 임상 처방이나 피팅 결과를 보장하지 않습니다.

## 모델과 단위

`geometry.js`는 mm 좌표계를 사용합니다. +x는 정면 관찰자 기준 화면 오른쪽, +y는 위쪽, +z는 전방이고 각막 꼭짓점은 z=0입니다. Steep axis는 +x에서 반시계방향이며 Flat axis는 90° 직교한다고 가정합니다. 반경은 각막계 굴절률 1.3375의 관례에 따른 `337.5/K`입니다. 초기 각막 직경 11.8 mm와 Q -0.25는 가정값이며 환자별 입력으로 변경합니다. 주변부 요약 수치를 반영해도 전체 지형도 재구성은 아닙니다.

렌즈는 반경0–3mm 구면, 3–4mm의 C2 5차 보간 Return zone, tan(LZA) 기울기의 Landing zone으로 구성합니다. RZD는 r3에서 r4까지의 sag 증가입니다. 말단0.35mm에25µm 들림을 별도로 가정했습니다. 3D 앞면과0.14mm 두께는 시각화용입니다. 정확한 제조사 가공 형상이나 CAD를 복원하지 않습니다. 입력 범위는 주문 가능 목록이 아닙니다.

`sampleFit`은 유한 Cartesian + polar 샘플 최소 수직 간격이2µm가 되도록 높이만 조절합니다. `fit.params`에 반영된 높이를 사용해 렌더링합니다. 중심 간격은 렌즈 중심 위치, 말단부 평균은 마지막0.35mm의 면적 격자 평균입니다. 반환 gap 단위는µm, `clearance`는mm입니다. 기울기는 평면 slope 근사이며 강체 회전이 아닙니다. HVID/수직 직경으로 만든 각막 경계 또는 실수 범위 밖은 NaN으로 제외하며, 유효 격자 비율을 표시합니다. 지도 빈 영역과3D 회색은 계산 불가입니다.

**ARK의 K 및 축만으로 각막 전체를 재구성할 수 없습니다.** 비구면도, 주변부 높이, 비대칭, 후면 및 두께를 측정하지 않습니다. 실제 분석에는 지형도/단층촬영/고도 자료가 필요합니다. 눈물 유체, 압력, 눈꺼풀, 안정성, 각막 변형, 치료 후 상피 변화, 교정 효과 및 임상적 적합도는 계산하지 않습니다. 음수 gap은 표면의 수학적 겹침입니다. 임상 검증을 거치지 않은 교육 도구입니다.

## 검증

`npm test`는 독립적 구면 기준값, 축 회전, RZD 단위, 구역 연속성, LZA 접선, 말단 가정, 두 직경, 위치/기울기, 수직 안착 및 gap 일치 여부와 환자별 Q·주변부 높이 제약·비대칭·경계·동공 겹침·BFS 단위·설정 복원을 확인합니다. 브라우저에서는 WebGL 렌더링, 입력 연동, 모델 전환, 시나리오, A/B 비교, JSON 저장/불러오기 및 반응형 화면을 확인합니다. 수치 테스트는 임상 검증을 뜻하지 않습니다.

## 공식 자료

- [Paragon 자료 진입점](https://paragonvision.com/resources/fitting-guides-package-inserts/)
- [FDA Professional Fitting Information](https://www.accessdata.fda.gov/cdrh_docs/pdf/P870024S043c.pdf)
- [FDA CRT 100 Package Insert](https://www.accessdata.fda.gov/cdrh_docs/pdf5/P050031C.pdf)
- [NIDEK ARK-1 사양](https://www.nidek.co.jp/wp-content/uploads/2024/02/ARK_1_AR_1_B01J005.pdf)

Paragon/CooperVision의 공식 제품이 아닙니다. 모든 표시는 정적 교육 모델의 출력입니다.
