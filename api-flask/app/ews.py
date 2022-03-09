"""Collect and parse Cambodia EWS-1294."""
from datetime import datetime, timedelta, timezone

from dateutil.parser import parse as dtparser

from flask import request

import numpy

import requests

from werkzeug.exceptions import BadRequest


BASE_API = 'https://api.ews1294.com/v1/'
DATA_COLLECTION_START_DATE_STR = '2021-05-01'


def parse_ews_params():
    """Transform params used for ews request."""
    only_dates = True if request.args.get('onlyDates') else False
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

    return only_dates, begin_datetime, end_datetime


def get_ews_responses(
        only_dates: bool,
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

    # datapoints endpoint requires to exend end date otherwise
    # it will return empty list
    datapoints_url = '{0}datapoints?start={1}&end={2}'.format(
        BASE_API, start_date, end_date + timedelta(days=1)
    )

    datapoints_resp = requests.get(datapoints_url)
    datapoints_resp.raise_for_status()
    datapoints = [
        {
            'location_id': _['location_id'],
            'level_date': dtparser(_['value'][0]).replace(tzinfo=timezone(timedelta(hours=7))),
            'level_value': _['value'][1]
        }
        for _ in datapoints_resp.json()
        if dtparser(_['value'][0]).date() <= start_date
    ]

    def get_datapoint(datapoints, location):
        """Get available datapoints for a given location."""
        properties = location['properties']
        location_id = properties['id']
        trigger_levels = properties['trigger_levels']
        location_datapoints = [_ for _ in datapoints if _['location_id'] == location_id]
        level_values = [_['level_value'] for _ in location_datapoints]
        maximum = int(numpy.max(level_values)) if len(level_values) > 0 else 0

        rows = list()
        dates = {'levels': 'River Level'}
        values = {'levels': 'Current'}
        warning_values = {'levels': 'Warning'}
        severe_values = {'levels': 'Severe Warning'}
        for index, item in enumerate(location_datapoints):
            dates[str(index)] = item['level_date']
            values[str(index)] = item['level_value']
            warning_values[str(index)] = trigger_levels['warning']
            severe_values[str(index)] = trigger_levels['severe_warning']

        columns = list(dates.keys())
        rows.append(dates)
        rows.append(values)
        rows.append(warning_values)
        rows.append(severe_values)
        return (maximum, {'rows': rows, 'columns': columns})

    def status_to_number(dataset, max_value, warning, severe):
        """Convert status string to number."""
        daily_count = len(dataset['rows'][0])
        if daily_count > 1:
            if max_value >= severe:
                return 3
            elif max_value >= warning:
                return 2
            else:
                return 1
        else:
            return 0

    def format_details(location):
        """Massage received location details into PRISM format."""
        coordinates = location['geometry']['coordinates']
        properties = location['properties']
        trigger_levels = properties['trigger_levels']
        severe = trigger_levels['severe_warning']
        warning = trigger_levels['warning']
        maximum = get_datapoint(datapoints, location)[0]
        dataset = get_datapoint(datapoints, location)[1]

        return {
            'lon': coordinates[0],
            'lat': coordinates[1],
            'id': properties['id'],
            'external_id': properties['external_id'],
            'name': properties['name'],
            'status': status_to_number(dataset, maximum, warning, severe),
            'status1': properties['status1'],
            'water_height': properties['water_height'],
            'watch_level': trigger_levels['watch_level'],
            'warning': warning,
            'severe_warning': severe,
            'start_date': start_date,
            'end_date': end_date,
            'max': maximum,
            'dataset': dataset
        }

    return list(map(format_details, features))
