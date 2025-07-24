# SAGA + PGMQ 코드 통합 방안 분석

> **분석 목적:** BFF 서버에 기존 saga+pgmq 코드를 통합하는 두 가지 방안의 장단점 비교

## 방안 1: org.biseo.bff 내부 통합

```
main/java/org/biseo/bff/Application.java  ← 기존 위치 유지
main/java/org/biseo/bff/
├── common/
│   ├── config/ (기존 + QueueInitializer, SagaConfiguration)
│   ├── exception/
│   ├── util/ (기존 + Util.java from saga)
│   ├── validation/
│   └── pgmq/ (PgmqService, MessageRepository - 공용 PGMQ 기능)
├── domain/
│   ├── core/
│   ├── keycloak/
│   └── saga/ (SagaDefinition, SagaOrchestrator, SagaStep 등 - 순수 saga 비즈니스 로직)
├── fusion/
│   ├── core/
│   ├── general/
│   ├── supportive/
│   └── saga/ (SagaController, SagaMessageProcessor, CompensationService - 복합 비즈니스 로직)
└── global/
    ├── response/
    └── dto/ (SagaCommand, SagaResponse 등 - 외부 통신용 DTO)
```

### ✅ 장점
- **기존 구조 유지:** BFF의 기존 폴더 구조(common, domain, fusion, global)를 그대로 활용
- **단순한 의존성:** 모든 코드가 하나의 모듈 내에서 관리되어 의존성이 단순함
- **자연스러운 통합:** saga가 BFF의 내부 기능으로 자연스럽게 통합

### ❌ 단점
- **미래 분리 어려움:** 향후 saga를 독립 서비스로 분리할 때 리팩토링 비용 증가
- **코드 증가:** BFF 프로젝트의 전체 코드량이 증가하여 복잡도 상승
- **모듈 경계 모호:** saga가 여러 폴더에 분산되어 모듈 전체 파악이 어려울 수 있음

## 2. 패키지 구조 분리 방안 비교

### 방안 2: org.biseo.bff vs org.biseo.saga 분리

```
main/java/org/biseo/Application.java  ← 메인 클래스 이동
main/java/org/biseo/bff/
├── common/
├── domain/
├── fusion/
└── global/

main/java/org/biseo/saga/
├── config/
├── controller/
├── core/
├── dto/
├── entity/
├── repository/
└── service/
```

### ✅ 장점
- **명확한 모듈 분리:** saga의 책임과 역할이 명확하게 분리됨
- **독립성 확보:** 각 모듈이 특정 기능을 대표하여 독립적 배포와 테스트 용이
- **미래 확장성:** 향후 saga를 별도 서비스로 추출할 때 용이함
- **관련 컴포넌트 집중:** saga 관련 모든 클래스를 한 곳에서 관리

### ❌ 단점
- **중복 가능성:** config, common 등의 공통 기능이 양쪽에 중복될 수 있음
- **의존성 복잡도:** bff와 saga 간 상호 의존성 관리 필요
- **프로젝트 복잡도 증가:** 두 개의 분리된 모듈 구조로 인한 복잡성

## 2. Spring Boot 관점에서의 기술적 고려사항

| 항목 | 통합 방안 (org.biseo.bff 내부) | 분리 방안 (org.biseo.bff vs org.biseo.saga) |
|------|--------------------------------|---------------------------------------------|
| 컴포넌트 스캔 | org.biseo.bff 루트에서 자동 스캔 | org.biseo 루트에서 자동 스캔 |
| 설정 복잡도 | 낮음 (단일 모듈) | 중간 (모듈 간 통신 고려) |
| 빌드 복잡도 | 낮음 (단일 JAR) | 중간 (멀티 모듈 고려 가능) |
| 테스트 격리 | 중간 (패키지별 테스트) | 높음 (모듈별 독립 테스트) |
| 배포 유연성 | 낮음 (단일 배포만 가능) | 높음 (향후 분리 배포 가능) |

## 3. 권장사항

### 🔍 전제 조건에 따른 권장사항

### Case 1: 향후 saga 서비스를 분리하지 않는다면

#### ✅ 추천: 방안 1 (org.biseo.bff 내부 통합)

**근거:**
- **기존 구조 활용:** BFF의 기존 common, domain, fusion, global 구조를 그대로 활용
- **팀 폴더 정의 부합:** 각 폴더의 역할 정의에 완벽히 맞는 코드 배치
- **자연스러운 통합:** saga가 BFF의 내부 기능으로 자연스럽게 통합

**권장 배치 (팀 정의 기준):**

#### 🏗️ 팀 폴더 정의와 saga 코드 배치

| 폴더 | 팀 정의 | Saga 코드 배치 |
|-------|---------|----------------|
| **common** | 프로젝트 내에서 공용으로 사용되는 코드 | PgmqService, 설정 클래스들 - 여러 곳에서 사용되는 공용 PGMQ 기능 |
| **domain** | 단일 도메인의 순수 비즈니스 로직, 독립적 모듈화 | SagaDefinition, SagaOrchestrator - saga 도메인의 핵심 비즈니스 로직 |
| **fusion** | 여러 도메인을 조합한 복합 비즈니스 로직, API 엔드포인트별 데이터 조합 | SagaController, CompensationService - 여러 도메인 서비스를 조합하는 로직 |
| **global** | 다른 도메인과 소통할 때 필요한 코드 | SagaCommand, SagaResponse - 외부 시스템과의 통신용 DTO |

### Case 2: 향후 saga 서비스 분리 가능성이 있다면

#### ✅ 추천: 방안 2 (org.biseo.bff vs org.biseo.saga 분리)

**근거:**
- **명확한 코드 구조:** saga와 BFF의 역할이 패키지 레벨에서 명확히 구분
- **코드 관리 용이성:** saga 관련 모든 코드를 한 패키지에서 집중 관리
- **팀 개발 효율성:** saga 기능 개발 시 관련 코드를 쉽게 찾고 수정 가능
- **아키텍처 일관성:** 기능별 패키지 분리로 Spring Boot 모범 사례 준수
- **단일 JAR 배포:** 여전히 하나의 실행 파일로 간단한 배포 유지

### Case 3: 현재 결정하기 어려운 상황이라면

#### 🔄 단계적 접근 방안 (방안 1 → 방안 2)

**1단계:** 우선 방안 1로 시작 (org.biseo.bff 내부 통합)
- 빠른 개발과 초기 검증에 집중
- saga+pgmq 기능의 안정성 확보
- 팀의 폴더 정의에 맞는 자연스러운 코드 배치

**2단계:** 필요 시 방안 2로 리팩토링 (분리)
- 서비스 성숙도가 높아지고 분리 필요성이 명확해질 때
- 팀 규모 확장이나 독립적 배포 요구사항 발생 시

### 📋 구현 단계별 가이드

1. **1단계:** Application.java 위치 결정 (전제 조건에 따라)
2. **2단계:** 패키지 구조 생성 및 코드 이관
3. **3단계:** 공통 설정 및 유틸리티 정리
4. **4단계:** 테스트 및 검증
5. **5단계:** 필요 시 단계적 리팩토링

## 4. 결론

선택은 **"향후 saga 서비스 분리 계획"**에 따라 달라집니다. 
분리 계획이 없다면 방안 1(내부 통합)이, 분리 가능성이 있다면 방안 2(패키지 분리)가 적합합니다.
확실하지 않다면 방안 1로 시작하여 필요 시 방안 2로 단계적 전환을 권장합니다.

> **핵심 결정 기준:** saga+pgmq의 미래 독립성 요구사항에 따라 현재의 아키텍처 선택이 결정되어야 합니다.

---
*작성일: 2025년 6월 20일 | 분석 기준: Spring Boot 모범 사례 및 Java 패키지 구조 원칙*
