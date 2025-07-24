# PostgreSQL vs Patroni: CQRS 이중화 구현을 위한 선택 근거

## 개요

이 문서는 CQRS(Command Query Responsibility Segregation) 패턴과 PostgreSQL 이중화 구현 시 기본 PostgreSQL 이미지 대신 Patroni를 선택한 이유와 근거를 설명합니다.

## 초기 목표

### 시스템 구성 요구사항
- **Master 1개**: 쓰기 전용 (Command Side)
- **Slave 1개**: Master 복제본
- **Read 3개**: 읽기 전용 (Query Side)
- **HAProxy**: 트래픽 라우팅 및 로드 밸런싱
- **자동 페일오버**: Master 장애 시 무중단 서비스

### CQRS 패턴 구현 목표
```
Application
    ↓
HAProxy
   ↙    ↘
Command   Query
(Write)   (Read)
   ↓        ↓
Master → Slaves/Reads
```

## PostgreSQL 기본 이미지의 한계

### 1. 수동 복제 설정
```yaml
postgres-master:
  image: postgres:15
  environment:
    - POSTGRES_DB=mydb
  # 문제점: 복제 설정을 수동으로 해야 함
```

**필요한 수동 작업**:
```bash
# Master 설정
echo "wal_level = replica" >> postgresql.conf
echo "max_wal_senders = 3" >> postgresql.conf

# Slave 설정
pg_basebackup -h master -D /var/lib/postgresql/data -U replicator
echo "standby_mode = 'on'" >> recovery.conf
```

### 2. HAProxy 역할 감지 불가능

**PostgreSQL 기본 이미지 문제점**:
```haproxy
backend postgres_master
    # ❌ 이런 동적 감지 불가능
    option httpchk GET /master
    server pg1 postgres-1:5432 check
```

**고정 설정만 가능**:
```haproxy
backend postgres_master
    server master postgres-master:5432 check
    server backup postgres-slave:5432 check backup
```

### 3. 수동 장애 복구
- Master 장애 시 관리자가 직접 개입 필요
- Slave를 Master로 수동 승격
- HAProxy 설정 수동 변경
- 서비스 중단 시간 발생

### 4. 모니터링 및 관리 복잡성
- 복제 상태 수동 확인
- 각 노드별 개별 관리
- 클러스터 전체 상태 파악 어려움

## Patroni 선택의 이유

### 1. 자동 클러스터 관리

**자동 역할 할당**:
```yaml
patroni1:
  image: patroni:4.0.6
  environment:
    PATRONI_NAME: patroni1
    PATRONI_SCOPE: postgres-cluster
  # Patroni가 자동으로 Master/Slave 역할 결정
```

**클러스터 상태 자동 관리**:
- 첫 번째 노드: 자동으로 Master가 됨
- 나머지 노드: 자동으로 Slave로 복제 설정
- 실시간 클러스터 상태 모니터링

### 2. HAProxy 동적 감지 지원

**Patroni REST API 활용**:
```haproxy
backend postgres_master
    option httpchk GET /master
    server patroni1 patroni1:5432 check port 8008
    server patroni2 patroni2:5432 check port 8008
    server patroni3 patroni3:5432 check port 8008

backend postgres_replicas
    option httpchk GET /replica
    server patroni1 patroni1:5432 check port 8008
    server patroni2 patroni2:5432 check port 8008
    server patroni3 patroni3:5432 check port 8008
```

**REST API 엔드포인트**:
- `/master`: Master 노드인지 확인 (HTTP 200/503)
- `/replica`: Replica 노드인지 확인 (HTTP 200/503)
- `/health`: 전반적인 건강 상태
- `/patroni`: 상세 클러스터 정보

### 3. 자동 페일오버

**장애 감지 및 복구 과정**:
```
1. Master 노드 장애 발생
    ↓
2. Patroni가 장애 감지 (etcd 통해)
    ↓
3. 가장 적합한 Slave를 Master로 자동 승격
    ↓
4. 나머지 노드들이 새 Master로 복제 재설정
    ↓
5. HAProxy가 새 Master 자동 감지하여 트래픽 라우팅
```

**무중단 서비스**:
- 장애 감지: 수 초 내
- 페일오버: 10-30초 내 완료
- 애플리케이션 레벨에서는 투명한 장애 처리

### 4. etcd 기반 분산 협조

**클러스터 상태 공유**:
```json
{
  "/postgres-cluster/leader": "patroni1",
  "/postgres-cluster/members/patroni1": {
    "role": "master",
    "state": "running",
    "api_url": "http://patroni1:8008"
  },
  "/postgres-cluster/members/patroni2": {
    "role": "replica",
    "state": "streaming"
  }
}
```

## 기능 비교표

| 기능 | PostgreSQL 기본 | Patroni |
|------|------------------|---------|
| 복제 설정 | 수동 | 자동 |
| 역할 감지 | 불가능 | REST API 제공 |
| 페일오버 | 수동 | 자동 |
| 클러스터 관리 | 개별 관리 | 통합 관리 |
| HAProxy 연동 | 정적 설정만 | 동적 감지 |
| 모니터링 | 수동 확인 | 실시간 API |
| 학습 곡선 | 높음 (수동 설정) | 중간 (설정 기반) |
| 운영 복잡도 | 높음 | 낮음 |

## CQRS 패턴 구현 효과

### Patroni 사용 시 CQRS 최적화

**Command Side (쓰기)**:
```haproxy
frontend postgres_write
    bind *:5432
    default_backend postgres_master

backend postgres_master
    option httpchk GET /master
    # 오직 Master 노드만 쓰기 처리
```

**Query Side (읽기)**:
```haproxy
frontend postgres_read
    bind *:5433
    default_backend postgres_replicas

backend postgres_replicas
    balance roundrobin
    option httpchk GET /replica
    # 모든 Replica 노드에 읽기 분산
```

### 트래픽 흐름

**쓰기 요청**:
```
App → HAProxy(5432) → Master PostgreSQL
```

**읽기 요청**:
```
App → HAProxy(5433) → Replica PostgreSQL (로드 밸런싱)
```

## 실제 구현 예시

### docker-compose.yml 구성
```yaml
services:
  etcd:
    image: quay.io/coreos/etcd:v3.5.9
    # 분산 설정 저장소

  patroni1:
    image: patroni:4.0.6
    environment:
      PATRONI_SCOPE: postgres-cluster
      PATRONI_NAME: patroni1
    # 자동 클러스터 참여

  haproxy:
    image: haproxy:2.8
    # 동적 트래픽 라우팅
```

### 클러스터 상태 확인
```bash
# 클러스터 전체 상태
curl http://localhost:8008/cluster

# Master 노드 확인
curl http://localhost:8008/master

# 복제 상태 확인
curl http://localhost:8008/patroni
```

## 장점과 고려사항

### Patroni 장점
- **자동화**: 복제, 페일오버, 역할 관리 자동화
- **고가용성**: 무중단 서비스 제공
- **CQRS 최적화**: 읽기/쓰기 트래픽 자동 분산
- **모니터링**: 실시간 클러스터 상태 확인
- **표준화**: 업계 검증된 HA 솔루션

### 고려사항
- **복잡성**: 초기 설정이 복잡할 수 있음
- **의존성**: etcd 등 추가 구성요소 필요
- **학습**: Patroni 개념과 설정 이해 필요
- **리소스**: 추가적인 시스템 리소스 사용

## 대안 비교

### PostgreSQL + 수동 설정
**적합한 경우**:
- 단순한 개발 환경
- 학습 목적
- 완전한 제어가 필요한 경우

**부적합한 경우**:
- 프로덕션 환경
- 자동 페일오버 필요
- CQRS 패턴 구현

### Patroni + etcd
**적합한 경우**:
- 프로덕션 환경
- 고가용성 요구
- CQRS 패턴 구현
- 자동화된 운영

## 결론

CQRS 패턴과 PostgreSQL 이중화를 제대로 구현하기 위해서는 다음 기능들이 필수적입니다:

1. **동적 역할 감지**: HAProxy가 실시간으로 Master/Slave 구분
2. **자동 페일오버**: 무중단 고가용성 서비스
3. **트래픽 라우팅**: 쓰기/읽기 요청을 적절한 노드로 자동 분산
4. **클러스터 관리**: 통합된 모니터링 및 관리

PostgreSQL 기본 이미지만으로는 이러한 요구사항을 충족하기 어렵지만, Patroni는 이 모든 기능을 제공하여 진정한 고가용성 CQRS 시스템 구축을 가능하게 합니다.

**최종 권장사항**: CQRS 패턴과 이중화가 목적이라면 Patroni 사용이 필수적이며, 이는 현대적인 클라우드 네이티브 환경에서 PostgreSQL 클러스터를 운영하는 표준적인 방법입니다.
