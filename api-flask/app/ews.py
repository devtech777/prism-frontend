"""Collect and parse Cambodia EWS-1294."""
from datetime import datetime, timedelta, timezone

from dateutil.parser import parse as dtparser

from flask import request

import requests

from werkzeug.exceptions import BadRequest, NotFound


BASE_API = 'https://api.ews1294.com/v1/'
DATA_COLLECTION_START_DATE_STR = '2021-05-01'


def parse_ews_params():
    """Transform params used for ews request."""
    only_dates = True if request.args.get('onlyDates') else False
    location_id = request.args.get('locationId', None)
    today = datetime.now().replace(tzinfo=timezone.utc)
    begin_datetime_str = request.args.get('beginDateTime')

    if begin_datetime_str is not None:
        begin_datetime = dtparser(begin_datetime_str)
    else:
        # yesterday
        begin_datetime = today
    begin_datetime = begin_datetime.replace(tzinfo=timezone.utc)

    end_datetime_str = request.args.get('endDateTime')
    if end_datetime_str is not None:
        end_datetime = dtparser(end_datetime_str)
    else:
        # today
        end_datetime = today
    end_datetime = end_datetime.replace(tzinfo=timezone.utc)

    # strptime function includes hours, minutes, and seconds as 00 by default.
    # This check is done in case the begin and end datetime values are the same.
    if end_datetime == begin_datetime:
        end_datetime = end_datetime + timedelta(days=1)

    if begin_datetime > end_datetime:
        raise BadRequest('beginDateTime value must be lower than endDateTime')

    if begin_datetime > today:
        raise BadRequest('beginDateTime value must be less or equal to today')

    return only_dates, location_id, begin_datetime, end_datetime


def get_ews_responses(
        only_dates: bool,
        location_id: int or str or None,
        begin: datetime,
        end: datetime
):
    """Get datapoints for sensor locations."""
    if only_dates:
        the_beginning = datetime.strptime(DATA_COLLECTION_START_DATE_STR, '%Y-%m-%d')
        today = datetime.now()
        days = [the_beginning + timedelta(days=d) for d in range((today - the_beginning).days+1)]
        return list(map(lambda d: {'date': d.strftime('%Y-%m-%d')}, days))

    start_date = begin.date()
    end_date = end.date()

    locations_url = '{0}locations?type=river&start={1}&end={2}'.format(
        BASE_API,
        start_date, end_date
    )

    resp = requests.get(locations_url)
    resp.raise_for_status()
    features = resp.json().get('features')

    def status_to_number(status):
        """Convert status string to number."""
        if(status == 'active'):
            return 1
        elif(status == 'watch'):
            return 2
        elif(status == 'warning'):
            return 3
        elif(status == 'severe_warning'):
            return 4
        else:
            return 0

    def format_details(location):
        """Massage received location details into PRISM format."""
        ACTIVE = 'active'
        OPERATIONAL = 'operational'

        coordinates = location['geometry']['coordinates']
        properties = location['properties']
        trigger_levels = properties['trigger_levels']
        is_active = properties['status'].lower() == ACTIVE
        is_operational = properties['status1'].lower() == OPERATIONAL

        return {
            'lon': coordinates[0],
            'lat': coordinates[1],
            'id': properties['id'],
            'external_id': properties['external_id'],
            'name': properties['name'],
            'status': status_to_number(properties['status']),
            'status1': properties['status1'],
            'is_available': 1 if is_active and is_operational else 0,
            'water_height': properties['water_height'],
            'watch_level': trigger_levels['watch_level'],
            'warning': trigger_levels['warning'],
            'severe_warning': trigger_levels['severe_warning'],
            'start_date': start_date,
            'end_date': end_date
        }

    locations = list(map(format_details, features))

    if location_id:
        filtered_locations = [_ for _ in locations if int(_['id']) == int(location_id)]

        if not filtered_locations:
            raise NotFound('locationId not found')

        location_url = '{0}datapoints?location={1}&start={2}&end={3}'.format(
            BASE_API,
            location_id,
            start_date, end_date
        )

        resp = requests.get(location_url)
        resp.raise_for_status()

        rows = list()
        dates = {'levels': 'River Level'}
        values = {'levels': 'Current'}
        warning_values = {'levels': 'Warning'}
        severe_values = {'levels': 'Severe Warning'}
        for index, item in enumerate(resp.json()):
            ict_tz = timezone(timedelta(hours=7))
            local_date = dtparser(item['value'][0]).replace(tzinfo=ict_tz)
            dates[str(index)] = local_date
            values[str(index)] = item['value'][1]
            warning_values[str(index)] = filtered_locations[0]['warning']
            severe_values[str(index)] = filtered_locations[0]['severe_warning']

        columns = list(dates.keys())
        rows.append(dates)
        rows.append(values)
        rows.append(warning_values)
        rows.append(severe_values)
        return {'rows': rows, 'columns': columns}
    else:
        return locations
