import React, { useEffect } from 'react';
import { GeoJSONLayer } from 'react-mapbox-gl';
import { get } from 'lodash';
import * as MapboxGL from 'mapbox-gl';
import { useDispatch, useSelector } from 'react-redux';
import { legendToStops } from '../layer-utils';
import { onToggleHover } from '../../../../utils/map-utils';
import { PointDataLayerProps } from '../../../../config/types';

import { addPopupData } from '../../../../context/tooltipStateSlice';
import {
  LayerData,
  loadLayerData,
} from '../../../../context/layers/layer-data';
import { layerDataSelector } from '../../../../context/mapStateSlice/selectors';
import { useDefaultDate } from '../../../../utils/useDefaultDate';
import { getFeatureInfoPropsData } from '../../utils';
import {
  addDataset,
  clearDataset,
  addPointTitle,
} from '../../../../context/chartDataStateSlice';

// Point Data, takes any GeoJSON of points and shows it.
function PointDataLayer({ layer }: { layer: PointDataLayerProps }) {
  const selectedDate = useDefaultDate(layer.id);

  const layerData = useSelector(layerDataSelector(layer.id, selectedDate)) as
    | LayerData<PointDataLayerProps>
    | undefined;
  const dispatch = useDispatch();

  const { data } = layerData || {};

  useEffect(() => {
    if (!data) {
      dispatch(loadLayerData({ layer, date: selectedDate }));
    }
  }, [data, dispatch, layer, selectedDate]);

  if (!data) {
    return null;
  }

  const circleLayout: MapboxGL.CircleLayout = { visibility: 'visible' };
  const circlePaint: MapboxGL.CirclePaint = {
    'circle-radius': 8,
    'circle-opacity': layer.opacity || 0.3,
    'circle-color': {
      property: layer.measure,
      stops: legendToStops(layer.legend),
    },
  };

  const onHoverHandler = (evt: any) => {
    const measure = get(
      evt.features[0],
      `properties.${layer.measure}`,
      'No data',
    );

    onToggleHover('pointer', evt.target);

    // by default add `measure` to the tooltip
    dispatch(
      addPopupData({
        [layer.title]: {
          data: measure,
          coordinates: evt.lngLat,
        },
      }),
    );

    // then add feature_info_props as extra fields to the tooltip
    dispatch(
      addPopupData(getFeatureInfoPropsData(layer.featureInfoProps || {}, evt)),
    );
  };

  const onClickHandler = (evt: any) => {
    // clear previous table dataset loaded first
    dispatch(clearDataset());
    const { properties } = evt.features[0];

    const status = get(properties, 'status');
    if (status === 0) {
      onToggleHover('not-allowed', evt.target);
      return;
    }

    const externalId = get(properties, 'external_id');
    const name = get(properties, 'name');
    const title = `River Level - ${name} (${externalId})`;

    dispatch(addPointTitle(title));
    const dataset = JSON.parse(get(properties, 'dataset'));
    dispatch(addDataset(dataset));
  };

  return (
    <GeoJSONLayer
      id={`layer-${layer.id}`}
      data={data}
      circleLayout={circleLayout}
      circlePaint={circlePaint}
      circleOnMouseMove={onHoverHandler}
      circleOnClick={onClickHandler}
    />
  );
}

export default PointDataLayer;
