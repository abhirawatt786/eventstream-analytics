# EventStream Analytics

**Backend system processing 100K+ events/min with real-time analytics dashboards**


## Overview

EventStream Analytics is a high-performance backend system designed to handle **large-scale event streams** while providing **real-time analytics dashboards**. The system is built to process **100,000+ events per minute**, aggregate metrics, and expose them via REST APIs and WebSocket streams for real-time monitoring.

This project demonstrates scalable backend architecture, queue-based processing, database design, and observability—making it a great portfolio piece for backend engineering and data-driven systems.

## Features

- High-throughput event ingestion via **REST API** and **WebSocket**  
- Real-time analytics metrics and dashboards  
- Backend event processing pipelines for aggregation and transformations  
- Scalable storage using **PostgreSQL** and **Redis** for counters and caching  
- Event simulation scripts to generate test data at 100K+ events/min  
- Dockerized setup for easy deployment and local testing  
- Unit tests for event processors and APIs  


## Tech Stack

| Layer                  | Technology |
|------------------------|-----------|
| Backend Language        | Node.js (or Python) |
| Event Streaming         | Kafka / Redis Streams |
| Database                | PostgreSQL, Redis |
| Real-time Dashboard     | WebSocket, REST API |
| Containerization        | Docker, Docker Compose |
| Testing                 | Jest / Pytest |

## Setup & Installation

1. **Clone the repository**
```bash
git clone https://github.com/abhirawatt786/eventstream-analytics.git
cd eventstream-analytics
