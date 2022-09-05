import base64
from hashlib import sha256
import pytest
import schemathesis
from fastapi.testclient import TestClient
from hypothesis import settings

from app.database.alert_database import AlertsDataBase
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def migrate_test_db():
    alerts_db = AlertsDataBase()
    # TODO: find a better way to do this, instead of copying them from
    # the js migration files
    q1 = """CREATE TABLE IF NOT EXISTS "alert" (
          "id" SERIAL NOT NULL,
          "email" character varying NOT NULL,
          "prism_url" character varying NOT NULL,
          "active" boolean NOT NULL DEFAULT true,
          "alert_name" character varying,
          "alert_config" jsonb NOT NULL,
          "min" integer,
          "max" integer,
          "zones" jsonb,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
          "last_triggered" TIMESTAMP,
          CONSTRAINT "PK_ad91cad659a3536465d564a4b2f" PRIMARY KEY ("id")
        )"""
    alerts_db.session.execute(q1)
    alerts_db.session.commit()
    q2 = """CREATE TABLE IF NOT EXISTS users (
        id bigserial NOT NULL,
        username varchar(255) NOT NULL,
        full_name varchar(255) NULL,
        email varchar(255) NOT NULL,
        hashed_password varchar(64) NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT users_pkey PRIMARY KEY (id),
        CONSTRAINT users_username_key UNIQUE (username)
    )"""
    alerts_db.session.execute(q2)
    password = 'secret1'
    alerts_db.session.execute(f"""INSERT INTO users(username, full_name, email, hashed_password)
        VALUES ('johndoe', 'John Doe', 'johndoe@example.com', '{sha256(password.encode('utf8')).hexdigest()}')
        ON CONFLICT (username) DO UPDATE 
            SET username = excluded.username
    """)
    alerts_db.session.commit()
    q3 = """CREATE TABLE IF NOT EXISTS user_zone_access (
        id bigserial NOT NULL,
        user_id bigserial NOT NULL,
        zones_url varchar(255) NOT NULL,
        has_access bool NOT NULL,
        CONSTRAINT user_zone_access_pkey PRIMARY KEY (id),
        CONSTRAINT fk_user_zone_access_user_id_users FOREIGN KEY (user_id) REFERENCES users(id)
    )"""
    alerts_db.session.execute(q3)
    alerts_db.session.execute("""INSERT INTO user_zone_access(user_id, zones_url, has_access)
        VALUES (1, 'https://prism-admin-boundaries.s3.us-east-2.amazonaws.com/mmr_admin_boundaries.json', '1')
    """)
    alerts_db.session.commit()


schema = schemathesis.from_asgi("/openapi.json", app)

# install all available compatibility fixups between schemathesis and fastapi
# see https://schemathesis.readthedocs.io/en/stable/compatibility.html
schemathesis.fixups.install(["fast_api"])

client = TestClient(app)


@pytest.mark.skip(reason="Slow: takes almost 10 minutes to complete")
@schema.parametrize(endpoint="^/stats")
@settings(max_examples=1)
def test_stats_api(case):
    """
    Run checks on the /stats endpoint listed in the openapi docs.

    These tests do not validate that the API returns valid results, but
    merely that it behaves according to the openAPI schema, and does not
    crash in random unexpected ways.
    This is basically fuzzying :)
    """

    response = case.call_asgi(app)
    case.validate_response(response)


@schema.parametrize(endpoint="^/alerts")
@settings(max_examples=10)
def test_alerts_api(case):
    """
    Run checks on all API endpoints listed in the openapi docs.

    These tests do not validate that the API returns valid results, but
    merely that it behaves according to the openAPI schema, and does not
    crash in random unexpected ways.
    This is basically fuzzying :)
    """

    response = case.call_asgi(app)
    case.validate_response(response)


def test_stats_endpoint1():
    """
    Call /stats with known-good parameters.
    This endpoint can be slow (>1 min) so this test is deactivated by default.
    """
    auth_str = base64.b64encode('johndoe:secret1'.encode('ascii'))
    response = client.post(
        "/stats",
        headers={
            "Accept": "application/json",
            "Authorization": f"Basic {auth_str}"
        },
        json={
            "geotiff_url": "https://odc.ovio.org/?service=WCS&request=GetCoverage&version=2.0.0&coverageId=wp_pop_cicunadj&subset=Long(92.172747098,101.170015055)&subset=Lat(9.671252102,28.54553886)",
            "zones_url": "https://prism-admin-boundaries.s3.us-east-2.amazonaws.com/mmr_admin_boundaries.json",
            "group_by": "TS_PCODE",
            "wfs_params": {
                "url": "https://geonode.wfp.org/geoserver/ows",
                "layer_name": "mmr_gdacs_buffers",
                "time": "2022-05-11",
                "key": "label",
            },
            "geojson_out": False,
        },
    )
    assert response.status_code == 200


def test_stats_endpoint2():
    """
    Call /stats with known-good parameters.
    """
    auth_str = base64.b64encode('johndoe:secret1'.encode('ascii'))
    response = client.post(
        "/stats",
        headers={
            "Accept": "application/json",
            "Authorization": f"Basic {auth_str}"
        },
        json={
            "geotiff_url": "https://odc.ovio.org/?service=WCS&request=GetCoverage&version=1.0.0&coverage=hfs1_sfw_mask_mmr&crs=EPSG%3A4326&bbox=92.2%2C9.7%2C101.2%2C28.5&width=1098&height=2304&format=GeoTIFF&time=2022-08-12",
            "zones_url": "https://prism-admin-boundaries.s3.us-east-2.amazonaws.com/mmr_admin_boundaries.json",
            "group_by": "TS",
            "geojson_out": False,
        },
    )
    assert response.status_code == 200


def test_stats_auth():
    """
    Call /stats with HTTP Basic Auth.
    """
    auth_str = base64.b64encode('johndoe:secret1'.encode('ascii'))
    response = client.post(
        "/stats",
        headers={
            "Accept": "application/json",
            "Authorization": f"Basic {auth_str}"
        },
        json={
            "geotiff_url": "https://odc.ovio.org/?service=WCS&request=GetCoverage&version=2.0.0&coverageId=wp_pop_cicunadj&subset=Long(92.172747098,101.170015055)&subset=Lat(9.671252102,28.54553886)",
            "zones_url": "https://prism-admin-boundaries.s3.us-east-2.amazonaws.com/mmr_admin_boundaries.json",
            "group_by": "TS_PCODE",
            "wfs_params": {
                "url": "https://geonode.wfp.org/geoserver/ows",
                "layer_name": "mmr_gdacs_buffers",
                "time": "2022-05-11",
                "key": "label"
            },
            "geojson_out": False
        }
    )
    assert response.status_code == 200


@pytest.mark.skip(reason="credentials required on the first 2 lines of this test")
def test_kobo_forms_endpoint(monkeypatch):
    """This test requires credentials for the kobo API."""
    monkeypatch.setenv("KOBO_USERNAME", "")
    monkeypatch.setenv("KOBO_PW", "")
    response = client.get(
        "/kobo/forms?beginDateTime=2022-08-18&endDateTime=2022-08-18&formName=1.%20%E1%9E%91%E1%9E%98%E1%9F%92%E1%9E%9A%E1%9E%84%E1%9F%8B%E1%9E%82%E1%9F%92%E1%9E%9A%E1%9F%84%E1%9F%87%E1%9E%91%E1%9E%B9%E1%9E%80%E1%9E%87%E1%9F%86%E1%9E%93%E1%9E%93%E1%9F%8B&datetimeField=Date_Dis&measureField=NumPeoAff&koboUrl=https://kobo.humanitarianresponse.info/api/v2/assets.json"
    )
    assert response.status_code == 200
