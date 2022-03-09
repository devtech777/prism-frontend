import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { GeoJSONLayer } from 'react-mapbox-gl';
import * as MapboxGL from 'mapbox-gl';
import { showPopup, hidePopup } from '../../../../context/tooltipStateSlice';
import { BoundaryLayerProps } from '../../../../config/types';
import { LayerData } from '../../../../context/layers/layer-data';
import {
  loadDataset,
  DatasetParams,
} from '../../../../context/chartDataStateSlice';
import {
  mapSelector,
  layerDataSelector,
} from '../../../../context/mapStateSlice/selectors';
import { toggleSelectedBoundary } from '../../../../context/mapSelectionLayerStateSlice';
import { isPrimaryBoundaryLayer } from '../../../../config/utils';
import { onlyBoundaryLayerUnderCursor } from '../../../../utils/map-utils';
import { getFullLocationName } from '../../../../utils/name-utils';

function onToggleHover(cursor: string, targetMap: MapboxGL.Map) {
  // eslint-disable-next-line no-param-reassign, fp/no-mutation
  targetMap.getCanvas().style.cursor = cursor;
}

function BoundaryLayer({ layer }: { layer: BoundaryLayerProps }) {
  const dispatch = useDispatch();
  const map = useSelector(mapSelector);
  const boundaryLayer = useSelector(layerDataSelector(layer.id)) as
    | LayerData<BoundaryLayerProps>
    | undefined;
  const { data } = boundaryLayer || {};

  if (!data) {
    return null; // boundary layer hasn't loaded yet. We load it on init inside MapView. We can't load it here since its a dependency of other layers.
  }

  const isPrimaryLayer = isPrimaryBoundaryLayer(layer);

  const onHoverHandler = (evt: any) => {
    dispatch(hidePopup());
    onToggleHover('pointer', evt.target);
    const coordinates = evt.lngLat;
    const locationName = getFullLocationName(layer, evt.features[0]);
    dispatch(showPopup({ coordinates, locationName }));
  };

  const onClickFunc = (evt: any) => {
    const { properties } = evt.features[0];

    // Since `event` is propagated on all layers we need to
    // Only allow click on boundary layer under cursor point on the map
    // This allows other layers to handle click event without interference
    if (!onlyBoundaryLayerUnderCursor(map, evt)) {
      return;
    }

    // send the selection to the map selection layer. No-op if selection mode isn't on.
    dispatch(
      toggleSelectedBoundary(evt.features[0].properties[layer.adminCode]),
    );

    const datasetParams: DatasetParams = {
      id: properties[layer.adminCode],
      filepath: 'data/mozambique/tables/moz-r1h-adm2-transposed.csv',
    };

    dispatch(loadDataset(datasetParams));

    // send the selection to the map selection layer. No-op if selection mode isn't on.
    dispatch(
      toggleSelectedBoundary(evt.features[0].properties[layer.adminCode]),
    );
  };

  // Only use mouse effects and click effects on the main layer.
  const { fillOnMouseEnter, fillOnMouseLeave, fillOnClick } = isPrimaryLayer
    ? {
        fillOnMouseEnter: onHoverHandler,
        fillOnMouseLeave: (evt: any) => onToggleHover('', evt.target),
        fillOnClick: onClickFunc,
      }
    : {
        fillOnMouseEnter: undefined,
        fillOnMouseLeave: undefined,
        fillOnClick: undefined,
      };

  return (
    <GeoJSONLayer
      id={`layer-${layer.id}`}
      data={data}
      fillPaint={layer.styles.fill}
      linePaint={layer.styles.line}
      fillOnMouseMove={fillOnMouseEnter}
      fillOnMouseLeave={fillOnMouseLeave}
      fillOnClick={fillOnClick}
    />
  );
}

export default BoundaryLayer;
