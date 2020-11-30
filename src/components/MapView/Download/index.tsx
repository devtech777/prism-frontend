import React, { useEffect, useRef, useState } from 'react';
import {
  Button,
  createStyles,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Hidden,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Theme,
  Typography,
  WithStyles,
  withStyles,
} from '@material-ui/core';
import Menu, { MenuProps } from '@material-ui/core/Menu';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileExport,
  faCaretDown,
  faImage,
} from '@fortawesome/free-solid-svg-icons';

import { useSelector } from 'react-redux';
import { mapSelector } from '../../../context/mapStateSlice/selectors';

const ExportMenu = withStyles((theme: Theme) => ({
  paper: {
    border: '1px solid #d3d4d5',
    backgroundColor: theme.palette.primary.main,
  },
}))((props: MenuProps) => (
  <Menu
    elevation={0}
    getContentAnchorEl={null}
    anchorOrigin={{
      vertical: 'bottom',
      horizontal: 'center',
    }}
    transformOrigin={{
      vertical: 'top',
      horizontal: 'center',
    }}
    {...props}
  />
));

const ExportMenuItem = withStyles((theme: Theme) => ({
  root: {
    color: theme.palette.common.white,
  },
}))(MenuItem);

function Download({ classes }: DownloadProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const selectedMap = useSelector(mapSelector);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  useEffect(() => {
    if (open && selectedMap) {
      const activeLayers = selectedMap.getCanvas();
      const canvas = previewRef.current;
      canvas!.setAttribute('width', activeLayers.width.toString());
      canvas!.setAttribute('height', activeLayers.height.toString());
      const context = canvas!.getContext('2d');
      context!.drawImage(activeLayers, 0, 0);
    }
  });

  const modalClose = () => {
    setOpen(false);
  };

  const download = () => {
    const canvas = previewRef!.current;
    const img = canvas!.toDataURL('image/png');
    const link = document.createElement('a');
    link.setAttribute('href', img);
    link.setAttribute('download', 'map.png');
    link.click();
    setOpen(false);
  };

  return (
    <Grid item>
      <Button variant="contained" color="primary" onClick={handleClick}>
        <FontAwesomeIcon style={{ fontSize: '1em' }} icon={faFileExport} />
        <Hidden smDown>
          <Typography className={classes.label} variant="body2">
            Export
          </Typography>
        </Hidden>
        <FontAwesomeIcon icon={faCaretDown} style={{ marginLeft: '10px' }} />
      </Button>
      <ExportMenu
        id="export-menu"
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={handleClose}
      >
        <ExportMenuItem>
          <ListItemIcon onClick={() => setOpen(true)}>
            <FontAwesomeIcon
              color="white"
              style={{ fontSize: '1em' }}
              icon={faImage}
            />
          </ListItemIcon>
          <ListItemText primary="PNG" />
        </ExportMenuItem>
      </ExportMenu>
      <Dialog
        maxWidth="xl"
        open={open}
        keepMounted
        onClose={modalClose}
        aria-labelledby="dialog-preview"
      >
        <DialogTitle className={classes.title} id="dialog-preview">
          Map Preview
        </DialogTitle>
        <DialogContent>
          <canvas ref={previewRef} />
        </DialogContent>
        <DialogActions>
          <Button onClick={modalClose} color="primary">
            Cancel
          </Button>
          <Button variant="contained" onClick={download} color="primary">
            Download
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}

const styles = (theme: Theme) =>
  createStyles({
    label: {
      marginLeft: '10px',
    },
    title: {
      color: theme.palette.text.secondary,
    },
  });

export interface DownloadProps extends WithStyles<typeof styles> {}

export default withStyles(styles)(Download);