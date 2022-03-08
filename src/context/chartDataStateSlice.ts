import moment from 'moment';
import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import * as Papa from 'papaparse';
import type { CreateAsyncThunkTypes, RootState } from './store';
import { TableRowType, TableData } from './tableStateSlice';

type DatasetState = {
  data?: TableData;
  title?: string;
  isLoading: boolean;
};

const initialState: DatasetState = { isLoading: false };

export type DatasetParams = {
  id: string;
  filepath: string;
};

export type EwsDatasetParams = {
  id: number;
  start: string;
  end: string;
};

export const loadDataset = createAsyncThunk<
  TableData,
  DatasetParams,
  CreateAsyncThunkTypes
>('datasetState/loadDataset', async (params: DatasetParams) => {
  const url = process.env.PUBLIC_URL + params.filepath;

  return new Promise<TableData>((resolve, reject) =>
    Papa.parse(url, {
      header: true,
      download: true,
      complete: results => {
        const row = results.data.find(item => item.Admin2_Code === params.id);

        return resolve({
          rows: [...results.data.slice(0, 1), row],
          columns: Object.keys(row),
        });
      },
      error: error => reject(error),
    }),
  );
});

export const loadEwsDataset = createAsyncThunk<
  TableData,
  EwsDatasetParams,
  CreateAsyncThunkTypes
>('datasetState/loadEwsDataset', async (params: EwsDatasetParams) => {
  const { id, start, end } = params;
  const url = `http://localhost/ews/data?locationId=${id}&beginDateTime=${start}&endDateTime=${end}`;

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`${resp.status}: ${resp.statusText}`);
  }
  const { rows, columns } = await resp.json();

  // Dataset object are not ordered sort dates
  const sortedRows = rows.map((row: TableRowType, index: number) => {
    if (index === 0) {
      const formattedRow: { [k: string]: string | number } = Object.assign(
        {},
        ...Object.entries(row).map(([k, v]) => ({
          [k]: moment(v).local().format('DD/MM/YYYY HH:mm'),
        })),
      );

      return Object.fromEntries(
        /* eslint-disable fp/no-mutating-methods */
        Object.entries(formattedRow)
          .sort(([, a], [, b]) => new Date(a).getTime() - new Date(b).getTime())
          .slice(0, -1),
      );
    }
    return row;
  });

  return { rows: sortedRows, columns };
});

export const datasetResultStateSlice = createSlice({
  name: 'DatasetResultSlice',
  initialState,
  reducers: {
    addDataset: (
      { ...rest },
      { payload }: PayloadAction<TableData>,
    ): DatasetState => {
      const { rows, columns } = payload;

      // Dataset object are not ordered sort dates
      const sortedRows = rows.map((row: TableRowType, index: number) => {
        if (index === 0) {
          const formattedRow: { [k: string]: string | number } = Object.assign(
            {},
            ...Object.entries(row).map(([k, v]) => ({
              [k]: moment(v).local().format('DD/MM/YYYY HH:mm'),
            })),
          );

          return Object.fromEntries(
            /* eslint-disable fp/no-mutating-methods */
            Object.entries(formattedRow)
              .sort(
                ([, a], [, b]) => new Date(a).getTime() - new Date(b).getTime(),
              )
              .slice(0, -1),
          );
        }
        return row;
      });
      return { ...rest, data: { rows: sortedRows, columns } };
    },
    clearDataset: (state): DatasetState => ({
      ...state,
      data: undefined,
    }),
    addPointTitle: ({ ...rest }, { payload }: PayloadAction<string>) => {
      return { ...rest, title: payload };
    },
  },
  extraReducers: builder => {
    builder.addCase(
      loadDataset.fulfilled,
      ({ ...rest }, { payload }: PayloadAction<TableData>): DatasetState => ({
        ...rest,
        data: payload,
      }),
    );

    builder.addCase(loadEwsDataset.pending, state => ({
      ...state,
      isLoading: true,
    }));

    builder.addCase(
      loadEwsDataset.fulfilled,
      ({ ...rest }, { payload }: PayloadAction<TableData>): DatasetState => ({
        ...rest,
        data: payload,
        isLoading: false,
      }),
    );
  },
});

export const DatasetSelector = (state: RootState): TableData | undefined =>
  state.datasetState.data;
export const loadingDatasetSelector = (state: RootState): boolean =>
  state.datasetState.isLoading;
export const PointTitleSelector = (state: RootState): string | undefined =>
  state.datasetState.title;

// Setters
export const {
  addDataset,
  clearDataset,
  addPointTitle,
} = datasetResultStateSlice.actions;

export default datasetResultStateSlice.reducer;
