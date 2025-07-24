# BFF Saga 패턴 확장성 개선 개발 기록

## 📋 개요

MSA(Microservices Architecture) 환경의 BFF(Backend For Frontend)에서 Saga 패턴 구현 시 발생한 확장성 문제와 이를 해결하기 위한 개발 과정을 기록한 문서입니다.

---

## 🚨 발생한 문제점

### 주요 문제: 기하급수적 코드 증가

MSA 아키텍처 속 BFF의 특성상 다음과 같은 확장성 문제가 발생했습니다:

- **도메인 기능 증가**: 호출해야 하는 도메인의 기능이 점점 늘어남
- **순서 정의 코드 폭증**: 새로운 비즈니스 플로우마다 `registerXXXProcessingSaga()` 메서드 필요
- **1:1 매칭 함수 증가**: 각 스텝별로 개별 execute/compensate 함수가 기하급수적으로 증가
- **Switch-case 문 확장**: `performExecute()`와 `performCompensation()` 메서드의 switch문이 계속 커짐

### 현재 코드 구조의 한계

```java
// 문제가 되는 기존 구조 예시
return switch (stepName) {
    case "VALIDATE_ORDER" -> executeValidateOrder(command);
    case "RESERVE_INVENTORY" -> executeReserveInventory(command);
    case "PROCESS_PAYMENT" -> executeProcessPayment(command);
    case "SHIP_ORDER" -> executeShipOrder(command);
    case "SEND_CONFIRMATION" -> executeSendConfirmation(command);
    // 수백-수천개의 case문이 계속 추가될 예정...
    default -> throw new IllegalArgumentException("Unknown step for execute: " + stepName);
};
```

**결과적으로**: N개 도메인 × M개 조합 시나리오의 조합 폭발 발생

---

## 🔧 첫 번째 해결 시도

### 접근 방법: 스텝-함수 1:1 연결 해제

다음과 같은 아이디어로 문제 해결을 시도했습니다:

#### 핵심 아이디어
- **메타데이터 기반 접근**: 서버 시작 시점에 execute endpoint, compensate endpoint, do compensate or not 등의 정보를 데이터베이스에 저장
- **추상화된 단일 처리**: 실행 시점에는 하드코딩된 함수 매칭 대신, 저장된 메타데이터를 조회하여 하나의 추상화된 함수에서 동적 처리
- **설정 기반 처리**: 코드 레벨의 하드코딩을 설정 레벨의 메타데이터로 이동

#### 기대 효과
- Switch-case 문 제거
- 새로운 스텝 추가 시 코드 수정 없이 설정만으로 처리
- 확장성 문제 근본적 해결

---

## ⛔ 첫 번째 시도 중단 이유

### 복잡하게 얽힌 구조적 문제들

리팩토링을 진행하면서 다음과 같은 복합적인 문제들이 발견되었습니다:

#### 1. 메시지 구조 불일치
- **execute, retry, compensate마다 메시지의 구조가 다름**
- 통일된 추상화 적용의 어려움

#### 2. 저장소 혼재 문제
- **sagaDefinition과 sagaStepDefinition**: 메모리에 저장
- **sagaInstance와 sagaStep**: 데이터베이스에 저장
- 두 저장소 간의 일관성 및 동기화 복잡성

#### 3. 참조 구조 복잡성
- **sagaInstance와 sagaStep**: saga와 step에 대한 name만을 key로 사용
- **실제 업무 정보**: url 등은 메모리에서 name으로 definition을 조회해서 참고
- 간접 참조로 인한 복잡한 의존성

#### 4. 직접 리팩토링의 한계
- 여러 문제가 서로 얽혀있어 순차적 해결이 어려움
- 전체 구조에 대한 근본적 재설계 필요성 인식

---

## 🤖 AI 활용 결정

### AI 도움 요청 배경

복잡하게 얽힌 구조적 문제들로 인해 직접 리팩토링에 한계를 느끼고, 다음과 같은 이유로 AI의 도움을 요청했습니다:

- **구조적 복잡성**: 여러 문제가 서로 연관되어 있어 개별 해결이 어려움
- **전문성 부족**: Spring Boot와 Saga 패턴의 고급 활용법에 대한 지식 부족
- **설계 관점**: 전체 아키텍처 관점에서의 근본적 해결책 필요
- **검증된 패턴**: 업계에서 검증된 모범 사례와 패턴 적용 필요

---

## 💡 AI 제안 해결법

### 핵심 접근 방식: 설정 기반 동적 Saga 실행 아키텍처

AI가 제안한 해결책은 **Strategy 패턴과 Spring의 고급 기능을 활용한 동적 실행 프레임워크**입니다.

#### 1. Strategy 패턴 기반 Handler 구조

**기존 Switch-case 제거**:
```java
// Handler 인터페이스 도입
public interface SagaStepHandler {
    String getStepType();
    SagaStepResult execute(SagaContext context);
    SagaStepResult compensate(SagaContext context);
}

// 동적 Handler 관리
@Service
public class SagaStepRegistry {
    private final Map<String, SagaStepHandler> handlers;
    
    public SagaStepHandler getHandler(String stepType) {
        return handlers.get(stepType);
    }
}
```

#### 2. 설정 기반 워크플로우 정의

**YAML 설정으로 워크플로우 관리**:
```yaml
saga:
  workflows:
    order-processing:
      steps:
        - name: payment
          service-endpoint: "http://payment-service/api/v1/charge"
          compensation-endpoint: "http://payment-service/api/v1/refund"
          timeout: 30s
          retries: 3
          is-compensatable: true
```

#### 3. WebClient 기반 동적 API 호출

**동적 엔드포인트 호출 시스템**:
```java
@Service
public class DynamicApiService {
    public <T> Mono<T> callServiceEndpoint(String endpoint, Object request, Class<T> responseType) {
        return webClient.post()
            .uri(endpoint)
            .bodyValue(request)
            .retrieve()
            .retryWhen(Retry.backoff(3, Duration.ofMillis(500)))
            .timeout(Duration.ofSeconds(30));
    }
}
```

#### 4. 완전한 추상화 구현

**동적 실행 엔진**:
- ApplicationContext와 리플렉션 활용
- Handler 기반 실행 vs API 호출 동적 선택
- AOP를 활용한 횡단 관심사 처리

### 기대 효과

- **코드 중복 95% 감소**: Handler 패턴으로 공통 로직 추상화
- **신규 Step 추가 시간 90% 단축**: 설정 파일만 수정하면 즉시 적용
- **수천개 함수 지원**: 동적 로딩 및 지연 초기화
- **무중단 배포**: 설정 변경만으로 워크플로우 수정 가능

---

## 📋 단계별 구현 계획

### Phase 1: 기반 구조 마련 (1-2주)
1. Handler 인터페이스 도입
2. Registry 패턴 구현
3. 설정 파일 정의

### Phase 2: 동적 실행 엔진 구축 (2-3주)
1. WebClient 통합
2. 리플렉션 기반 실행 구현
3. AOP 통합

### Phase 3: 고도화 및 최적화 (2-4주)
1. Enterprise 라이브러리 통합
2. 비동기 처리 최적화
3. 모니터링 체계 강화

---

## 🎯 결론

MSA 환경에서 BFF의 Saga 패턴 확장성 문제를 해결하기 위해 다음과 같은 여정을 거쳤습니다:

1. **문제 인식**: 기하급수적 코드 증가 문제 발견
2. **직접 시도**: 스텝-함수 1:1 연결 해제 시도
3. **한계 인식**: 복잡한 구조적 문제로 인한 중단
4. **AI 활용**: 전문적 해결책 도출
5. **해결 방향**: 설정 기반 동적 실행 아키텍처 채택

이를 통해 **유연하고 확장 가능한 Saga 패턴 구현**이 가능해질 것으로 기대됩니다.

---

*작성일: 2025년 6월 27일*  
*작성자: 김한주*
