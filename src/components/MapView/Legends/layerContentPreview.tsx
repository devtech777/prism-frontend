import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { useSelector } from 'react-redux';
import parse, { domToReact, HTMLReactParserOptions } from 'html-react-parser';
import { Element } from 'domhandler/lib/node';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  IconButton,
  createStyles,
  Dialog,
  DialogContent,
  Grid,
  Theme,
  Typography,
  WithStyles,
  withStyles,
} from '@material-ui/core';
import InfoIcon from '@material-ui/icons/Info';
import { isMainLayer, LayerType } from '../../../config/types';
import { LayerDefinitions } from '../../../config/utils';
import { layersSelector } from '../../../context/mapStateSlice/selectors';

const LayerContentPreview = ({ layerId, classes }: PreviewProps) => {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const contentRef = useRef<HTMLHeadingElement>(null);
  const layer = LayerDefinitions[layerId || 'admin_boundaries'];
  const selectedLayers = useSelector(layersSelector);
  // display if layer without group or main layer in group
  const canDisplayContent = isMainLayer(layerId as string, selectedLayers);
  const hasContent = layer.contentPath?.length;
  const domId = layer.contentPath?.split('#')?.[1];

  marked.use({ sanitizer: DOMPurify.sanitize });

  useLayoutEffect(() => {
    if (contentRef.current !== null) {
      contentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  });

  useEffect(() => {
    if (layer.contentPath) {
      fetch(layer.contentPath)
        .then(response => response.text())
        .then(text => setContent(text));
    }
  }, [hasContent, layer.contentPath]);

  const transform: HTMLReactParserOptions = {
    replace: domNode => {
      if (domNode instanceof Element && domNode.attribs?.id === domId) {
        return React.createElement(
          domNode.name,
          {
            id: domNode.attribs.id,
            ref: contentRef,
          },
          domToReact(domNode.children, transform),
        );
      }
      return domNode;
    },
  };

  return (
    <Grid item>
      <IconButton size="small" className={classes.icon}>
        {canDisplayContent && hasContent && (
          <InfoIcon fontSize="inherit" onClick={() => setOpen(true)} />
        )}
      </IconButton>
      <Dialog
        maxWidth="md"
        open={open}
        keepMounted
        onClose={() => setOpen(false)}
        aria-labelledby="dialog-preview"
      >
        <DialogContent>
          <Typography color="textSecondary">
            {parse(marked(content), transform)}
          </Typography>
        </DialogContent>
      </Dialog>
    </Grid>
  );
};

const styles = (theme: Theme) =>
  createStyles({
    icon: {
      top: '-4px',
      fontSize: '14px',
    },
    label: {
      marginLeft: '10px',
    },
    title: {
      color: theme.palette.text.secondary,
      fontWeight: 'bold',
      minWidth: '600px',
    },
  });

export interface PreviewProps extends WithStyles<typeof styles> {
  layerId?: LayerType['id'];
}

export default withStyles(styles)(LayerContentPreview);
