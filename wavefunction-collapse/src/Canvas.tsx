import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fabric } from 'fabric';
import './Canvas.css';

import base1 from './img/base1.png';
import base2 from './img/base2.png';

type PartHash = string;

interface Part {
  hash: PartHash;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  connections: Array<PartHash>;
}

interface Position {
  x: number;
  y: number;
}

interface Tile extends Part, Position {
}

interface Player extends Position {
  obj: fabric.Object;
}

interface Dimensions {
  width: number;
  height: number;
}

async function getImgMeta(url: string): Promise<Dimensions> {
  return new Promise<Dimensions>(resolve => {
    const img = new Image();
    img.addEventListener('load', function() {
        resolve({ width: this.naturalWidth, height: this.naturalHeight });
    });
    img.src = url;
  });
}

function computeTaxiDistance(obj1: Part, obj2: Part) {
  return Math.abs(obj1.startX - obj2.startX) + Math.abs(obj1.startY - obj2.startY);
}

const image = base2;

const parts: Record<string, Part> = {};
getImgMeta(base2).then(dimensions => {
  console.log('dimensions = ', dimensions);

  for(let x = 0; x < dimensions.width; x++) {
    for(let y = 0; y < dimensions.height; y++) {
      const hash = x + ',' + y;
      parts[hash] = { hash, startX: x, startY: y, endX: x+1, endY: y+1, connections: [] };
    }
  }

  for(let part1 of Object.values(parts)) {
    for(let part2 of Object.values(parts)) {
      if(!part1.connections.includes(part2.hash) && computeTaxiDistance(part1, part2) === 1) {
        part1.connections.push(part2.hash);
      }
    }
  }

  console.log('parts = ', parts);
});

let seed = 12345;
function nextRandom(): number {
    var x = Math.sin(seed++) * 10000;
    return Math.floor(Math.abs(x));
}

function Canvas({ width = 1024, height = 1024, scalingFactor = 16, playerStartX = 16, playerStartY = 12 }) {
  const canvasRef = React.createRef<HTMLCanvasElement>();

  const [canvas, setCanvas] = useState<fabric.StaticCanvas | null>(null);

  const rect = useMemo(() => {
    return new fabric.Rect({
        left: (playerStartX + .125) * scalingFactor,
        top: (playerStartY + .125) * scalingFactor,
        width: .75 * scalingFactor,
        height: .75 * scalingFactor,
        fill: 'red',
    })
  }, [playerStartX, playerStartY, scalingFactor]);

  const [player, setPlayer] = useState<Player>({ x: playerStartX, y: playerStartY, obj: rect });
  
  const [currentTile, setCurrentTile] = useState<Tile | null>(null);

  const tiles: Array<Array<Tile | null>> = useMemo(() => {
    const tiles: Array<Array<Tile | null>> = [];
    for(let x = 0; x < width / scalingFactor; x++) {
      tiles[x] = [];
      for(let y = 0; y < height / scalingFactor; y++) {
        tiles[x][y] = null;
      }
    }
    return tiles;
  }, [width, height, scalingFactor]);

  const getNextTile = useCallback((pos: Position): [Tile | null, boolean] => {
    const foundTile = tiles[pos.x][pos.y];
    // is here already a tile?
    if(foundTile != null) {
      return [foundTile, false];
    }
    console.log('currentTile = ', currentTile);
    // is there no currentTile? create the first one
    if(currentTile == null) {
      const partArray = Object.values(parts);
      const randomIndex = nextRandom() % partArray.length
      return [{
        ...partArray[randomIndex],
        x: pos.x,
        y: pos.y,
      }, true];
    }

    const surroundingTiles = [
      tiles[pos.x+1][pos.y],
      tiles[pos.x-1][pos.y],
      tiles[pos.x][pos.y+1],
      tiles[pos.x][pos.y-1],
    ];
    console.log('surroundingTiles = ', surroundingTiles);
    const allPossibleConnections = surroundingTiles.flatMap(tile => tile == null ? [] : tile.connections);
    console.log('allPossibleConnections = ', allPossibleConnections);
    const randomIndex = nextRandom() % currentTile.connections.length;
    console.log('randomIndex = ', randomIndex);
    const hash = allPossibleConnections[randomIndex];
    console.log('hash = ', hash);
    console.log('parts[hash] = ', parts[hash]);

    if(parts[hash] == null) {
      return [null, false];
    } else {
      return [{
        ...parts[hash],
        x: pos.x,
        y: pos.y,
      }, true];
    }
  }, [tiles, currentTile]);

  const generateNewTile = useCallback((player: Player): void => {
    const [tile, newTile] = getNextTile(player);
    console.log('tile = ', tile, ', newTile = ', newTile);
    if(newTile && tile != null) {
      setCurrentTile(tile);

      fabric.Image.fromURL(image, function (imgInstance) {
        if(canvas) {
          let filter = new fabric.Image.filters.Resize({
            resizeType: 'bilinear', // bilinear, hermite, sliceHack, lanczos
            scaleX: scalingFactor / 2,
            scaleY: scalingFactor / 2,
          });
          imgInstance.filters!.push(filter);
          imgInstance.applyFilters([filter])
          imgInstance.set({
            left: tile.x * scalingFactor,
            top: tile.y * scalingFactor,
            scaleX: scalingFactor,
            scaleY: scalingFactor,
            width: tile.endX - tile.startX,
            height: tile.endY - tile.startY,
            cropX: tile.startX,
            cropY: tile.startY,
          });
          canvas.add(imgInstance);
        }
      });
      console.log('tiles[tile.x][tile.y] = ', tile);
      tiles[tile.x][tile.y] = tile;
    }
  }, [canvas, getNextTile, scalingFactor, tiles]);

  useEffect(() => {
    rect.set({
      left: (player.x + .125) * scalingFactor,
      top: (player.y + .125) * scalingFactor,
    });
    if(canvas != null && currentTile != null) {
      // console.log('useEffect(): 1111 invoking generateNewTile');
      generateNewTile(player);
    }
    rect.bringToFront();
  }, [canvas, generateNewTile, player, rect, scalingFactor, tiles, currentTile]);

  useEffect(() => {
    if(canvas != null && currentTile == null) {
      // console.log('useEffect(): 222 invoking generateNewTile');
      generateNewTile(player);
    }
  }, [canvas, generateNewTile, player, tiles, currentTile]);

  useEffect(() => {
    if(canvasRef.current != null && canvas == null) {
      const canvas = new fabric.StaticCanvas(canvasRef.current);

      canvas.add(rect);

      canvas.setWidth(width);
      canvas.setHeight(height);
      canvas.renderAll();
      
      setCanvas(canvas);
    }
  }, [canvas, canvasRef, height, width, rect]);

  const onKeyDown = (e: { code: string }) => {
    //console.log('clientX = ', e.clientX, ', clientY', e.clientY);
    console.log('onKeyDown(): e.code = ', e.code);

    if(['KeyW', 'ArrowUp'].includes(e.code)) {
      setPlayer({ x: player.x, y: player.y-1, obj: player.obj });
    } else if(['KeyS', 'ArrowDown'].includes(e.code)) {
      setPlayer({ x: player.x, y: player.y+1, obj: player.obj });
    } else if(['KeyA', 'ArrowLeft'].includes(e.code)) {
      setPlayer({ x: player.x-1, y: player.y, obj: player.obj });
    } else if(['KeyD', 'ArrowRight'].includes(e.code)) {
      setPlayer({ x: player.x+1, y: player.y, obj: player.obj });
    }
  };

  document.onkeydown = (e) => {
    onKeyDown(e);
  };

  return (
    <div onKeyDown={onKeyDown}>
      <canvas id="canvas" ref={canvasRef} width={width} height={height} onKeyDown={onKeyDown} onKeyUp={onKeyDown}></canvas>
    </div>
  );
}

export default Canvas;