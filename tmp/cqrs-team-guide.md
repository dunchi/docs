# CQRS 도커 프로젝트 팀 가이드

## 📖 개요
Docker, Patroni, HAProxy를 활용한 CQRS 아키텍처 프로젝트입니다.
**읽기와 쓰기를 완전 분리**하여 성능과 가용성을 향상시킵니다.

## 🏗️ 아키텍처

```
Write Network (쓰기용)           Read Network (읽기용)
┌─────────────────────┐         ┌─────────────────────┐
│ etcd + patroni1,2   │ ──────→ │ postgres-read1,2,3  │
│ (Master-Slave)      │ 복제    │ (읽기 전용)          │
└─────────────────────┘         └─────────────────────┘
          ↑                              ↑
          │                              │
      ┌─────────────────────────────────────┐
      │           HAProxy                  │
      │ Write: 15000  Read: 15001         │
      └─────────────────────────────────────┘
```

**핵심 원리**:
- **Command(쓰기)**: 15000포트 → Master-Slave DB
- **Query(읽기)**: 15001포트 → 3개 읽기 전용 DB
- **복제**: 실시간 스트리밍으로 데이터 동기화
- **페일오버**: Master 장애시 Slave 자동 승격

## 🚀 빠른 시작

### 1. 설치
```bash
git clone https://github.com/nicemso/temp-cqrs.git
cd temp-cqrs

# Patroni 이미지 빌드 (최초 1회만)
git clone https://github.com/patroni/patroni.git
cd patroni && docker build -t patroni:4.0.6 . && cd ..

# 전체 시스템 시작
docker compose up -d
```

### 2. 상태 확인
```bash
# 서비스 상태
docker compose ps

# 클러스터 상태
curl http://localhost:8008/cluster

# 모니터링 대시보드
open http://localhost:18080/stats
```

## 🧪 테스트

### CQRS 동작 확인
```bash
# 1. 쓰기 테스트 (Command)
psql -h localhost -p 15000 -U postgres -c "
  CREATE TABLE test (id SERIAL, message TEXT);
  INSERT INTO test (message) VALUES ('Hello CQRS');
"

# 2. 읽기 테스트 (Query) 
psql -h localhost -p 15001 -U postgres -c "
  SELECT * FROM test;
"

# 3. 읽기 DB 쓰기 차단 확인
psql -h localhost -p 15001 -U postgres -c "
  INSERT INTO test (message) VALUES ('Should fail');
"
# 결과: ERROR: cannot execute INSERT in a read-only transaction
```

### 자동화 테스트
```bash
cd test-application
python3 test_haproxy.py              # 전체 테스트
python3 test_haproxy.py --interactive # 대화형 테스트
```

## 🔧 운영 가이드

### 모니터링
- **HAProxy Stats**: http://localhost:18080/stats
- **복제 상태**: `SELECT * FROM pg_stat_replication;` (Write DB에서)
- **서비스 로그**: `docker compose logs -f`

### 페일오버 테스트
```bash
# Master 중지 → 자동 페일오버 확인
docker stop patroni1
curl http://localhost:8009/master  # 200 응답으로 변경되어야 함

# 복구
docker start patroni1
```

### Read DB 확장
```yaml
# docker-compose.yml에 추가
postgres-read4:
  image: postgres:16
  # ... 기존 read1과 동일한 설정
  ports:
    - "5443:5432"
```

## 🎯 핵심 포인트

### 장점
- **성능**: 읽기 부하 분산으로 응답속도 향상
- **가용성**: 자동 페일오버로 무중단 서비스
- **확장성**: Read DB 추가로 읽기 성능 스케일링

### 주의사항
- **복제 지연**: 수 밀리초 지연 가능 (일반적으로 무시 가능)
- **읽기 전용**: Read DB에서 쓰기 시도시 오류 발생
- **연결 분리**: 애플리케이션에서 용도별 포트 구분 필수

### 포트 정리
| 용도 | 포트 | 설명 |
|------|------|------|
| Write | 15000 | 모든 쓰기 작업 (INSERT, UPDATE, DELETE) |
| Read | 15001 | 모든 읽기 작업 (SELECT) |
| Stats | 18080 | HAProxy 모니터링 대시보드 |
| Direct | 5432-5442 | 개별 DB 직접 접근 (디버깅용) |

---
**📚 참고 자료**:
- [CQRS 패턴](https://docs.microsoft.com/en-us/azure/architecture/patterns/cqrs)
- [Patroni 문서](https://patroni.readthedocs.io/)
- [PostgreSQL 복제](https://www.postgresql.org/docs/current/high-availability.html)
