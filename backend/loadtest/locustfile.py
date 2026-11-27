"""Load drill: a lecture of students using the Lab at once (docs/load-drill.md).

Each simulated student uploads the example dataset once, then keeps changing settings on the
analysis pages with a few seconds' pause, as the debounced UI does. One request in five is a
bootstrap interval (B = 1000), the heaviest thing the UI asks for by default.

    DATASET=Howell.csv COLUMN=height locust -f loadtest/locustfile.py --headless \
        -u 60 -r 2 -t 10m --host http://127.0.0.1:8000 --csv drill

Run the backend with AUTH_DISABLED=true (every simulated student is then the same dev user).
A 404 (the server restarted, or the session expired) is answered the way the UI answers it:
upload again and carry on. It is counted under its own name, not as a failure.
"""

import os
import random
from pathlib import Path

from locust import HttpUser, between, task

DATASETS = Path(__file__).resolve().parents[2] / "frontend" / "public" / "datasets"
DATASET = os.getenv("DATASET", "Howell.csv")
COLUMN = os.getenv("COLUMN", "height")
CSV_BYTES = (DATASETS / DATASET).read_bytes()


class Student(HttpUser):
    wait_time = between(2, 5)

    def on_start(self):
        self.upload()

    def upload(self):
        response = self.client.post("/api/data/upload", files={"file": (DATASET, CSV_BYTES, "text/csv")},
                                    name="upload")
        self.session = response.json()["session_id"] if response.ok else ""

    def analyse(self, name: str, path: str, body: dict):
        payload = {"session_id": self.session, "column": COLUMN, **body}
        with self.client.post(path, json=payload, headers={"x-session-id": self.session},
                              name=name, catch_response=True) as response:
            if response.status_code == 404:
                response.success()
                self.environment.events.request.fire(
                    request_type="POST", name="session lost, uploaded again", response_time=0,
                    response_length=0, exception=None, context={})
                self.upload()
            elif not response.ok:
                response.failure(f"{response.status_code}: {response.text[:120]}")

    @task(3)
    def descriptive(self):
        self.analyse("descriptive", "/api/descriptive/compute",
                     {"quantileProbs": random.choice([[0.25, 0.5, 0.75], [0.1, 0.5, 0.9]])})

    @task(2)
    def graphical(self):
        self.analyse("graphical", "/api/graphical/compute",
                     {"graph_type": random.choice(["Histogram", "ECDF"]), "add_normal": random.random() < 0.5})

    @task(2)
    def intervals(self):
        self.analyse("inference ci", "/api/inference/ci", {"alpha": random.choice([0.01, 0.05, 0.1])})

    @task(2)
    def bootstrap(self):
        self.analyse("inference ci bootstrap B=1000", "/api/inference/ci",
                     {"bootstrap_mean": True, "bootstrap_median": True, "bootstrap_deviation": True,
                      "bootstrap_samples": 1000})

    @task(1)
    def hypothesis(self):
        self.analyse("hypothesis", "/api/hypothesis/test",
                     {"test_type": "One sample Student's t-test", "mu0": random.choice([0, 100, 150])})
