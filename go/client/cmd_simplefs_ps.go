// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"text/tabwriter"

	"golang.org/x/net/context"

	"encoding/hex"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// CmdSimpleFSPs is the 'simplefs list' command.
type CmdSimpleFSPs struct {
	libkb.Contextified
	opid    keybase1.OpID
	path    keybase1.Path
	recurse bool
	argOpid bool // set when -o is used
}

// NewCmdDeviceList creates a new cli.Command.
func NewCmdSimpleFSPs(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "ps",
		Usage: "list running operations",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdDeviceList{Contextified: libkb.NewContextified(g)}, "ps", c)
		},
	}
}

// RunClient runs the command in client/server mode.
func (c *CmdSimpleFSPs) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	ops, err := cli.SimpleFSGetOps(context.TODO())

	c.output(ops)

	return err
}

func getPathString(path keybase1.Path) string {
	pathType, err := path.PathType()
	if err != nil {
		return ""
	}
	if pathType == keybase1.PathType_KBFS {
		return path.Kbfs()
	}
	return path.Local()
}

func outputOp(w *tabwriter.Writer, o keybase1.OpDescription) {
	op, err := o.AsyncOp()
	if err != nil {
		fmt.Fprintf(w, "%s", err)
		return
	}
	switch op {
	case keybase1.AsyncOps_LIST:
		list := o.List()
		fmt.Fprintf(w, "%s\t%s\t%s\n", hex.EncodeToString(list.OpID[:]), op.String(), getPathString(list.Path))
	case keybase1.AsyncOps_LIST_RECURSIVE:
		list := o.ListRecursive()
		fmt.Fprintf(w, "%s\t%s\t%s\n", hex.EncodeToString(list.OpID[:]), op.String(), getPathString(list.Path))
	case keybase1.AsyncOps_READ:
		read := o.Read()
		fmt.Fprintf(w, "%s\t%s\t%s\t%d\t%d\n", hex.EncodeToString(read.OpID[:]), op.String(), getPathString(read.Path), read.Offset, read.Size)
	case keybase1.AsyncOps_WRITE:
		write := o.Write()
		fmt.Fprintf(w, "%s\t%s\t%s\t%d\n", hex.EncodeToString(write.OpID[:]), op.String(), getPathString(write.Path), write.Offset)
	case keybase1.AsyncOps_COPY:
		copy := o.Copy()
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\n", hex.EncodeToString(copy.OpID[:]), op.String(), getPathString(copy.Src), getPathString(copy.Dest))
	case keybase1.AsyncOps_MOVE:
		move := o.Move()
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\n", hex.EncodeToString(move.OpID[:]), op.String(), getPathString(move.Src), getPathString(move.Dest))
	case keybase1.AsyncOps_REMOVE:
		remove := o.Remove()
		fmt.Fprintf(w, "%s\t%s\t%s\n", hex.EncodeToString(remove.OpID[:]), op.String(), getPathString(remove.Path))
	}
}

func (c *CmdSimpleFSPs) output(ops []keybase1.OpDescription) {
	w := GlobUI.DefaultTabWriter()
	for _, e := range ops {
		outputOp(w, e)
	}
	w.Flush()
}

// ParseArgv does nothing for this command.
func (c *CmdSimpleFSPs) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	c.recurse = ctx.Bool("recurse")
	if ctx.String("opid") != "" {
		opid, err := hex.DecodeString(ctx.String("opid"))
		if err != nil {
			return err
		}
		if copy(c.opid[:], opid) != len(c.opid) {
			return fmt.Errorf("bad opid")
		}
		c.argOpid = true
	}

	if nargs == 1 {
		c.path = MakeSimpleFSPath(c.G(), ctx.Args()[0])
	} else {
		err = fmt.Errorf("List requires a path argument.")
	}

	return err
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSPs) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
