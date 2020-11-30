import { FeatureCollection } from 'geojson';
import { get, isNull, isString, map } from 'lodash';
import { BoundaryLayerProps, NSOLayerProps } from '../../config/types';
import type { ThunkApi } from '../store';
import { getBoundaryLayerSingleton } from '../../config/utils';
import type { LayerData, LayerDataParams, LazyLoader } from './layer-data';
import { layerDataSelector } from '../mapStateSlice/selectors';

export type DataRecord = {
  adminKey: string; // refers to a specific admin boundary feature (cell on map). Could be several based off admin level
  value: string | number | null;
};

export type NSOLayerData = {
  features: FeatureCollection;
  layerData: DataRecord[];
};

export const fetchNSOLayerData: LazyLoader<NSOLayerProps> = () => async (
  { layer }: LayerDataParams<NSOLayerProps>,
  api: ThunkApi,
) => {
  const { source, adminCode, dataField } = layer;
  const { getState } = api;

  const adminBoundaryLayer = getBoundaryLayerSingleton();

  const adminBoundariesLayer = layerDataSelector(adminBoundaryLayer.id)(
    getState(),
  ) as LayerData<BoundaryLayerProps> | undefined;
  if (!adminBoundariesLayer || !adminBoundariesLayer.data) {
    // TODO we are assuming here it's already loaded. In the future if layers can be preloaded like boundary this will break.
    throw new Error('Boundary Layer not loaded!');
  }
  const adminBoundaries = adminBoundariesLayer.data;

  const result: any = await (
    await fetch(source!.path, {
      mode: source!.path.includes('http') ? 'cors' : 'same-origin',
    })
  ).json();

  const { DataList: rawJSONs }: { DataList: { [key: string]: any }[] } =
    source!.type === 'file'
      ? result
      : {
          DataList: map(Object.entries(result.data), (e: any) => {
            return {
              CODE: e[0],
              A2NAME: e[1][0],
              [dataField]: e[1][1] === 'None' ? 0 : parseFloat(e[1][1]),
            };
          }),
        };

  const layerData = (rawJSONs || [])
    .map(point => {
      const adminKey = point[adminCode] as string;
      if (!adminKey) {
        return undefined;
      }
      const value = get(point, dataField);
      return { adminKey, value };
    })
    .filter((v): v is DataRecord => v !== undefined);

  const features = {
    ...adminBoundaries,
    features: adminBoundaries.features
      .map(feature => {
        const { properties } = feature;
        const adminBoundaryCode = get(
          properties,
          adminBoundaryLayer.adminCode,
        ) as string;
        const match = layerData.find(({ adminKey }) =>
          adminBoundaryCode.startsWith(adminKey),
        );
        if (match && !isNull(match.value)) {
          // Do we want support for non-numeric values (like string colors?)
          return {
            ...feature,
            properties: {
              ...properties,
              data: isString(match.value)
                ? parseFloat(match.value)
                : match.value,
            },
          };
        }
        return undefined;
      })
      .filter(f => f !== undefined),
  } as FeatureCollection;

  return {
    features,
    layerData,
  };
};
