import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  createStyles,
  Theme,
  Grid,
  Paper,
  WithStyles,
  withStyles,
  IconButton,
  CircularProgress,
} from '@material-ui/core';
import { Close } from '@material-ui/icons';
import {
  DatasetSelector,
  PointTitleSelector,
  loadingDatasetSelector,
  clearDataset,
} from '../../context/chartDataStateSlice';
import Chart from '../DataDrawer/Chart';
import { ChartConfig } from '../../config/types';
import { isLoading } from '../../context/mapStateSlice/selectors';
import { isLoading as areDatesLoading } from '../../context/serverStateSlice';

function DataViewer({ classes }: DatasetProps) {
  const [open, setOpen] = useState(false);
  const dispatch = useDispatch();
  const layersLoading = useSelector(isLoading);
  const datesLoading = useSelector(areDatesLoading);
  const loading = layersLoading || datesLoading;
  const isDatasetLoading = useSelector(loadingDatasetSelector);

  const dataset = useSelector(DatasetSelector);
  const title = useSelector(PointTitleSelector);

  const config: ChartConfig = {
    type: 'line',
    stacked: false,
    fill: false,
    category: 'Admin2_Code',
  };

  useEffect(() => {
    if (loading) {
      dispatch(clearDataset());
    }
    if (isDatasetLoading || dataset) {
      setOpen(!loading);
    }

    if (!isDatasetLoading && !dataset) {
      setOpen(false);
    }
  }, [dispatch, dataset, isDatasetLoading, loading]);

  return (
    <>
      {open && (
        <Grid item className={classes.container}>
          <Paper className={classes.paper}>
            <IconButton size="small" onClick={() => setOpen(false)}>
              <Close fontSize="small" />
            </IconButton>
            {dataset ? (
              <Chart title={title || ''} config={config} data={dataset} />
            ) : (
              <div className={classes.loading}>
                <CircularProgress size={50} />
              </div>
            )}
          </Paper>
        </Grid>
      )}
    </>
  );
}

const styles = (theme: Theme) =>
  createStyles({
    container: {
      textAlign: 'right',
      marginTop: 8,
    },
    paper: {
      padding: 8,
      width: 480,
    },
    title: {
      color: theme.palette.text.secondary,
    },
    loading: {
      height: 240,
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

export interface DatasetProps extends WithStyles<typeof styles> {}

export default withStyles(styles)(DataViewer);
