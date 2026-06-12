# InfluxDB

The Compose stack initializes organization `k6`, bucket `k6`, and a local-only development token.
The bucket defaults to a seven-day retention period through `INFLUXDB_RETENTION`. Override
credentials, token, and retention before exposing the stack outside a developer workstation.
