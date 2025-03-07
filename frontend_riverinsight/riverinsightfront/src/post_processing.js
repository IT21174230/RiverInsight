
// translate original distances from scaled distances
function getDescaledDistances(distance){
    return distance/12;
}

// get shifted point
function shiftedPoint(control_point, unscaled_distance){
    yc=control_point[1];
    ys=yc + unscaled_distance;
    return (control_point[0], ys);
}

