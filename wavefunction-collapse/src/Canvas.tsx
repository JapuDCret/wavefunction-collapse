import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fabric } from 'fabric';
import './Canvas.css';

import test from './img/test.png';

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

const sourceImageWidth = 4;
const sourceImageHeight = 4;
const parts: Record<string, Part> = {};
for(let x = 0; x < sourceImageWidth; x++) {
  for(let y = 0; y < sourceImageHeight; y++) {
    const hash = x + ',' + y;
    parts[hash] = { hash, startX: x, startY: y, endX: x+1, endY: y+1, connections: [] };
  }
}

function computeTaxiDistance(obj1: Part, obj2: Part) {
  return Math.abs(obj1.startX - obj2.startX) + Math.abs(obj1.startY - obj2.startY);
}

for(let part1 of Object.values(parts)) {
  for(let part2 of Object.values(parts)) {
    if(computeTaxiDistance(part1, part2) == 1) {
      part1.connections.push(part2.hash);
    }
  }
}

console.log('parts = ', parts);

let seed = 12345;
function nextRandom(): number {
    var x = Math.sin(seed++) * 10000;
    return Math.floor(Math.abs(x));
}

function Canvas({ width = 1024, height = 1024, scalingFactor = 16, playerStartX = 16, playerStartY = 12 }) {
  const canvasRef = React.createRef<HTMLCanvasElement>();

  const [canvas, setCanvas] = useState<fabric.StaticCanvas | null>(null);

  const rect = new fabric.Rect({
      left : playerStartX * scalingFactor,
      top : playerStartY * scalingFactor,
      width : 1 * scalingFactor,
      height : 1 * scalingFactor,
      fill : 'red'
  });

  const [player, setPlayer] = useState<Player>({ x: playerStartX, y: playerStartY, obj: rect });
  
  const [currentTile, setCurrentTile] = useState<Tile | null>(null);

  const tiles: Array<Array<Tile | null>> = [];
  for(let x = 0; x < width / scalingFactor; x++) {
    tiles[x] = [];
    for(let y = 0; y < width / scalingFactor; y++) {
      tiles[x][y] = null;
    }
  }

  const generateNewTile = (player: Player): void => {
    const [tile, newTile] = getNextTile(currentTile, player);
    if(newTile) {
      setCurrentTile(tile);

      fabric.Image.fromURL(test, function (imgInstance) {
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
      tiles[tile.x][tile.y] = tile;
    }
  };
  const getNextTile = (currentTile: Tile | null, pos: Position): [Tile, boolean] => {
    const foundTile = tiles[pos.x][pos.y];
    if(foundTile != null) {
      return [foundTile, false];
    }
    if(currentTile == null) {
      const partArray = Object.values(parts);
      const randomIndex = nextRandom() % partArray.length
      return [{
        ...partArray[randomIndex],
        x: pos.x,
        y: pos.y,
      }, true];
    }

    const randomIndex = nextRandom() % currentTile.connections.length;
    const hash = currentTile.connections[randomIndex];
  
    return [{
      ...parts[hash],
      x: pos.x,
      y: pos.y,
    }, true];
  };

  useEffect(() => {
    if(canvas != null) {
      generateNewTile(player);
    }
  }, [canvas]);

  useEffect(() => {
    if(canvasRef.current != null && canvas == null) {
      const canvas = new fabric.StaticCanvas(canvasRef.current);

      canvas.add(rect);

      canvas.setWidth(width);
      canvas.setHeight(height);
      canvas.renderAll();
      
      setCanvas(canvas);
    }
  }, [canvasRef, height, width]);

  useEffect(() => {
    rect.set({
      left : player.x * scalingFactor,
      top : player.y * scalingFactor,
    });
    generateNewTile(player);
  }, [player]);

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