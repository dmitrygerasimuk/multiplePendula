let colors = [
    "#8dd3c7",
    "#ffffb3",
    "#bebada",
    "#fb8072",
    "#80b1d3",
    "#fdb462",
    "#b3de69",
    "#fccde5",
    "#d9d9d9",
    "#bc80bd",
    "#ccebc5",
    "#ffed6f",
];

class Trace {
    constructor(color, maxHistory) {
        this.color = color;
        this.posHistory = [];
        this._maxHistory = maxHistory;
    }
    update(x,y) {
        this.posHistory.push([x,y]);
        while (this.posHistory.length > this._maxHistory) {
            this.posHistory.shift();
        }
    }
    draw(canvas) {
        // Draw trace
        canvas.noFill();
        canvas.strokeWeight(1);
        let color = canvas.color(this.color);
        for (let i = 1; i < this.posHistory.length; i++) {
            let opac = Math.floor(255*(this._maxHistory - this.posHistory.length + i)/this._maxHistory);
            color.setAlpha(opac);
            canvas.stroke(color);
            canvas.line(this.posHistory[i-1][0],this.posHistory[i-1][1],this.posHistory[i][0],this.posHistory[i][1]);
        }
    }
}

class Pendulum {
    constructor(radius,color) {
        this.r = radius;
        this.massColor = color;
    }
    
    update(xo,yo,x,y,rodColor) {
        this.xo = xo;
        this.yo = yo;
        this.x = x;
        this.y = y;
        this.rodColor = rodColor;
    }
    
    draw(canvas) {
        // Rod
        canvas.noFill();
        let rc = canvas.color(this.rodColor);
        rc.setAlpha(220);
        canvas.stroke(rc);
        canvas.strokeWeight(3);
        canvas.line(this.xo,this.yo,this.x,this.y);
        
        // Mass
        canvas.noStroke();
        let mc = canvas.color(this.massColor);
        mc.setAlpha = 200;
        canvas.fill(this.massColor);
        canvas.ellipse(this.x,this.y,this.r,this.r);
    }
}

class Pendula {
    constructor(angles,lengths,masses) {
        if (!angles) {
            angles = [Math.PI/4,Math.PI/8];
            lengths = [100,100];
            masses = [2,2];
        }
        if (!lengths || lengths.length < angles.length) {
            console.log("Not enough lengths given. Filling with unit lengths.");
            while (lengths.length < angles.length) {
                lengths.push(1);
            }
        }
        if (!masses || masses.length < angles.length) {
            console.log("Not enough masses given. Filling with unit masses.");
            while (masses.length < angles.length) {
                masses.push(1);
            }
        }
        if (!g) {
            this.g = 1;
        }
        
        this.g = g;
        this._angles = angles;
        this._lens = lengths;
        this._masses = masses;
        this._traces = [];
        this._traceList = [];
        this.reset();
        
        this.posHistory = [];
        for (let i = 0; i < this.n; i++) {
            this.posHistory[i] = [];
        }
        // Keep only up to 500 registers per trace
        this._maxHistory = 500;
        
        this.integrateStep = this.rk4Step;
        
    }
    
    reset() {
        this.n = this._angles.length;
        this.s = math.matrix(this._angles); // State: Column vector of angles followed by their rates
        this.s.resize([2 * this.n], 0);
        this.ang = this.s.subset(math.index(math.range(0, this.n))).valueOf();
        this.angd = this.s.subset(math.index(math.range(this.n, 2 * this.n))).valueOf();
        let rm_scale = 15; // Proportion between mass and radius^2
        this.T = math.zeros(this.n);
        this._pendula = [];
        this.initialEnergy = undefined;
        this._starting = true;

        // Add/remove lengths and masses as necessary
        while (this._lens.length < this.n) {
            this._lens.push(100);
        }
        while (this._masses.length < this.n) {
            this._masses.push(4);
        }
        this._masses.length = this.n;
        this._lens.length = this.n;

        // Create each pendulum and assign color for masses
        this.rs = math.multiply(math.sqrt(this._masses),rm_scale); // Radii
        for (let i = 0; i < this.n; i++) {
            let j = i%(colors.length);
            this._pendula.push(new Pendulum(this.rs[i],colors[j]));
        }

        this.traceList = this._traceList.slice();
    }
    
    set traceList(list) {
        // Clean the trace list
        this._traceList.length = 0;
        this._traces.length = 0;
        // this.posHistory.length = 0;
        for (let i = 0; i < list.length; i++) {
            if (list[i].isNumeric && list[i] >= 0 || list[i] < this.n) {
                this._traceList.push(list[i]);
                this._traces.push(new Trace(colors[list[i]],this._maxHistory));
            }
        }
    }
    
    get traceList() {
        return this._traceList;
    }
    
    set maxHistory(maxHistory) {
        this._maxHistory = maxHistory;
        for (let tr of this._traces) {
            tr._maxHistory = maxHistory;
        }
    }
    
    get maxHistory() {
        return this._maxHistory;
    }
    
    set angleList(angles) {
        this._angles = angles;
        this.reset();
    }
    
    useRK4() {
        this.integrateStep = this.rk4Step;
    }
    
    useEuler() {
        this.integrateStep = this.eulerStep;
    }
    
    update() {
        let h = 0.05;
        let n = 10;
        for (let i = 0; i < n; i++) {
            this.integrateStep(h);
            this.ang = this.s.subset(math.index(math.range(0,this.n))).valueOf();
            this.angd = this.s.subset(math.index(math.range(this.n,2*this.n))).valueOf();
            if (this.n == 1) {
                this.ang = [this.ang];
                this.angd = [this.angd];
            }
        }
    }
    
    getRodColor(t) {
        // Make color reflect tension strength: red for tension, blue for compression and brightness for intensity
        let intensity = math.round(50 + 200/(1 + math.exp(-t))); // Sigmoid function amplified to 0-255
        let color = 'rgba(' + (t<0)*intensity + ',0,' + (t>=0)*intensity + ',1)';
        return color;
    }
    
    draw(canvas) {
        if (!canvas) {
            console.error("Where do you want me to draw? Pass a p5.js canvas to draw.");
            return;
        }
        // Get XY coordinates, which are only needed when drawing
        let x = [0];
        let y = [0];
        for (let i = 0; i < this.n; i++) {
            x[i+1] = x[i] + this._lens[i]*math.cos(this.ang[i]);
            y[i+1] = y[i] + this._lens[i]*math.sin(this.ang[i]);
        }
        
        // b = true: pendula in action. b = false: pendula paused
        // Update trace and energy only if pendula are in action (or it's first frame)
        if (b || this._starting) {
            for (let i = 0; i < this._traceList.length; i++) {
                const j = this._traceList[i] +1 ;
                this._traces[i].update(x[j],y[j]);
            }
            for (let i = 0; i < this.n; i++) {
                this._pendula[i].update(x[i],y[i],x[i+1],y[i+1],this.getRodColor(this.T.valueOf()[i]));
            }            
            this.getEnergy(y);
        }
        
        // Draw trace and pendula
        this._traces.map((tr) => tr.draw(canvas));
        this._pendula.map((p) => p.draw(canvas));
    }
    
    eulerStep(h) {
        /*
        Euler method implementation
        h: step size
        */
        let y = this.s.clone();
        let k = this.evaluateAt(y);
        this.s = math.add(this.s,math.multiply(k,h));
        
    }
    
    rk4Step(h) {
        /*
        4-th order Runge-Kutta implementation
        h: step size
        */
        let y = this.s.clone();
        let k1 = this.evaluateAt(y);
        let k2 = this.evaluateAt(math.add(y,math.multiply(k1,0.5*h)));
        let k3 = this.evaluateAt(math.add(y,math.multiply(k2,0.5*h)));
        let k4 = this.evaluateAt(math.add(y,math.multiply(k3,    h)));
        
        this.s = math.add(this.s,math.multiply((math.add(math.add(k1,math.multiply(k2,2)), math.add(math.multiply(k3,2), k4))),h/6));
    }
    
    evaluateAt(y) {
        /*
        y: state, column vector containing 'ang' followed by 'angd' (read below)
        Derivative is not an explicit function of time, so I am not requiring that input.
        
        Matrices A, B, C, and D are used in the derivation of the equations:
        A.angdd - B.angd2 = wc + D.t
        -B.angdd - A.angd2 = ws + C.t
        Angles are measured from horizontal-right and positive in clock-wise direction
        ang:   vector containing angular positions
        angd:  vector containing first time derivative of angular positions
        angdd: vector containing second time derivative of angular positions
        angd2: vector containing squares of first time derivative of angular positions
        wc:    vector containing tangential component of weight (respect to their local polar frame)
        ws:    vector containing radial component of weight (respect to their local polar frame)
        t:     vector containing the value of tension by string connecting to previous particle
        */
        let A = math.zeros(this.n,this.n); 
        let B = math.zeros(this.n,this.n);
        let C = math.zeros(this.n,this.n);
        let D = math.zeros(this.n,this.n);
        
        let ang  = y.subset(math.index(math.range(0     ,  this.n))).valueOf();
        let angd = y.subset(math.index(math.range(this.n,2*this.n))).valueOf();
        
        // When n == 1 ang and angd are coming out as scalars and that's breaking several things.
        // These n==1 conditionals are patches
        if (this.n == 1) {
            ang  = [this.ang];
            angd = [this.angd];
        }
        let angd2 = math.square(angd);
        
        // Fill vectors
        let wc;
        let ws;
        if (this.n == 1) {
            wc = this._masses[0] * math.cos(ang[0]) * this.g;
            ws = this._masses[0] * math.sin(ang[0]) * this.g;
        } else {
            wc = math.multiply(math.dotMultiply(this._masses,math.cos(ang)),this.g);
            ws = math.multiply(math.dotMultiply(this._masses,math.sin(ang)),this.g);
        }
        
        // Fill matrices
        for (let i = 0; i < this.n; ++i) {
            A.subset(math.index(i,i),this._lens[i]*this._masses[i]);
            for (let j = 0; j < i; ++j) {
                A.subset(math.index(i,j),this._lens[j]*this._masses[i]*math.cos(ang[j] - ang[i]));
                B.subset(math.index(i,j),this._lens[j]*this._masses[i]*math.sin(ang[j] - ang[i]));
            }
            C.subset(math.index(i,i),-1);
            if (i < this.n-1) { 
                C.subset(math.index(i,i+1),math.cos(ang[i+1] - ang[i]));
                D.subset(math.index(i,i+1),math.sin(ang[i+1] - ang[i]));
            }
        }
        
        // angdd = (A+D.Cinv.B)inv.[wc - D.Cinv.ws + (B-D.Cinv.A).angd2]
        // Helpers to make angdd more readable
        let Cinv   = math.inv(C);              // Inverse of C
        let DCinv  = math.multiply(D,Cinv);    // D.Cinv
        let DCinvA = math.multiply(DCinv,A);   // D.Cinv.A
        let DCinvB = math.multiply(DCinv,B);   // D.Cinv.B
        let tmp1   = math.add(A,DCinvB);       // (A+D.Cinv.B)
        let tmp2   = math.subtract(B,DCinvA);  // (B-D.Cinv.A)
        
        // angdd = (tmp1)inv. (wc - DCinv.ws + tmp2.angd2)
        let Y = math.matrix(math.zeros(y.size()));
        Y.subset(math.index(math.range(0,this.n)), math.subset(y,math.index(math.range(this.n,2*this.n))));
        let Y2 = math.multiply(
            math.inv(tmp1)
            ,
            math.add(
                math.subtract(
                    wc
                    ,
                    math.multiply(DCinv,ws)
                )
                ,
                math.multiply(tmp2 , angd2)
            )
        ).valueOf();
        if (this.n == 1) {
            Y2 = Number(Y2[0]);
        }
        Y.subset(math.index(math.range(this.n,2*this.n)), Y2);
        
        // Get tensions: T = -Cinv.(ws + B.angdd + A.angd2)
        this.T = math.multiply(
            math.multiply(Cinv,-1) ,
            math.add(
                math.add(
                    ws,
                    math.multiply(B,Y2)
                ),
                math.multiply(A,angd2)
            )
        )
        return Y;
    }
    
    getEnergy(y) {
        // Compute energy
        let k = 0; // Kinetic energy
        let v = 0; // Potential energy
        for (let i = 0; i < this.n; i++) {
            let sumr = 0; // Radial component of velocity
            let sumq = 0; // Tangential component of velocity
            for (let j = 0; j <= i; j++) {
                sumr += this._lens[j]*this.angd[j]*math.sin(this.ang[j] - this.ang[i]);
                sumq += this._lens[j]*this.angd[j]*math.cos(this.ang[j] - this.ang[i]);
            }
            k += 0.5*this._masses[i]*(sumr*sumr + sumq*sumq);
            v -= this._masses[i]*this.g*y[i+1]; // Negative since y points down
        }
        
        let totalEnergy = k + v;
        
        // Store initial energy
        if (!this.initialEnergy) {
            this.initialEnergy = totalEnergy;
        }
        
        // Print to document
        document.getElementById("energy").innerHTML = "Total energy: " + totalEnergy.toFixed(6) + ", Kinetic: " + k.toFixed(6) + ", Potential: " + v.toFixed(6) + ", Change from start: " + (totalEnergy - this.initialEnergy).toFixed(6);
    }
}