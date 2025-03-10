
// translate original distances from scaled distances
export function getDescaledDistances(distance){
    return distance/12;
}

// get shifted point
export function shiftedPoint(control_point, unscaled_distance){
    yc=control_point[1];
    ys=yc + unscaled_distance;
    return (control_point[0], ys);
}



